import { useEffect } from 'react';
import { useRoute } from './router';
import { useUI } from './state/ui';
import { useStudy } from './state/study';
import { useSettings } from './state/settings';
import { useLibrary } from './state/library';
import { useIncoming } from './state/incoming';
import { useIntro } from './state/intro';
import { Intro } from './components/Intro';
import { consentPending, track, useAnalytics } from './analytics';
import { appUrl, readPath, searchWithoutRef, sheetFromHash } from './link';
import { Reader } from './screens/Reader';
import { Settings } from './screens/Settings';
import { Privacy } from './screens/Privacy';
import { Terms } from './screens/Terms';
import { Plan } from './screens/Plan';
import { Progress } from './screens/Progress';
import { ConsentSheet } from './components/ConsentSheet';
import { ShareSheet } from './components/ShareSheet';
import { MenuSheet } from './components/MenuSheet';
import { NavigatorSheet } from './components/NavigatorSheet';
import { TextSettingsSheet } from './components/TextSettingsSheet';
import { NoteSheet } from './components/NoteSheet';
import { InstallSheet } from './components/InstallSheet';
import { FeedbackSheet } from './components/FeedbackSheet';
import { CompareSheet } from './components/CompareSheet';
import { XrefSheet } from './components/XrefSheet';
import { AskCrash, AskSheet } from './components/AskSheet';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ListenSheet } from './components/ListenSheet';
import { SearchSheet } from './components/SearchSheet';
import { LibrarySheet } from './components/LibrarySheet';
import { StudySheet } from './components/StudySheet';
import { DevotionalSheet } from './components/DevotionalSheet';
import { markShownToday, shownToday, useDevotional } from './state/devotional';
import { DeleteAccountSheet } from './components/DeleteAccountSheet';
import { Toast } from './components/Toast';

/** The #/library, #/study and #/devotional/<day> links open the reader with that sheet on top. */
// The daily devotional needs content packs in public/devotional/<lang>.json. Without them it stays off (VITE_DEVOTIONAL=1 enables it).
const DEVOTIONAL = import.meta.env.VITE_DEVOTIONAL === '1';
let sheetFromLink = sheetFromHash(location.hash);
if (!DEVOTIONAL && sheetFromLink?.name === 'devotional') sheetFromLink = null;

export default function App() {
  const route = useRoute();
  const { sheet, close } = useUI();

  // The URL follows the reading: /<version>/<book>/<chapter>
  const book = useStudy((s) => s.book);
  const chapter = useStudy((s) => s.chapter);
  const versionId = useSettings((s) => s.versionId);
  const installed = useLibrary((s) => !!s.installed[versionId]);
  const ready = useLibrary((s) => s.ready);
  const pending = useIncoming((s) => s.incoming !== null);
  // While advertising pixels are on, the address bar stays at the root so third parties never see the book and chapter.
  const homeUrl = useUI((s) => s.homeUrl) || useAnalytics((s) => s.marketing) === 'granted';

  // The initial intro is only for those who arrive without any Bible. Those already using the app do not see it.
  const introDone = useIntro((s) => s.done);
  const hasVersions = useLibrary((s) => Object.keys(s.installed).length > 0);
  useEffect(() => {
    if (ready && hasVersions && !introDone) useIntro.getState().finish();
  }, [ready, hasVersions, introDone]);

  useEffect(() => {
    if (route !== '/' || !ready || !installed || pending) return;
    const sync = () => {
      const path = homeUrl ? new URL(appUrl()).pathname : readPath(versionId, book, chapter);
      const search = searchWithoutRef();
      if (location.pathname !== path || location.hash || location.search !== search) history.replaceState(history.state, '', path + search);
    };
    sync();
    // Closing a sheet goes back one history entry, which may hold a URL from before the reading changed.
    // With a route in the URL (#/settings), the router navigates, so it does nothing.
    const onPop = () => !location.hash && sync();
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [route, ready, installed, pending, homeUrl, versionId, book, chapter]);

  // Changing screens closes sheets and scrolls back to the top
  useEffect(() => {
    close();
    if (sheetFromLink && route === '/') {
      const { name, day } = sheetFromLink;
      sheetFromLink = null;
      history.replaceState(null, '', location.pathname + location.search);
      if (name === 'devotional') {
        track('link_open', { kind: 'devotional' });
        useDevotional.setState({ day: day ?? null, source: 'link' });
      }
      useUI.getState().open(name);
    }
  }, [route, close]);

  // Privacy choice: asked once, after the intro, never over another sheet. Everything optional stays off until answered.
  useEffect(() => {
    if (route !== '/' || !ready || !installed || pending || !introDone || sheet || !consentPending()) return;
    useUI.getState().open('consent');
  }, [route, ready, installed, pending, introDone, sheet]);

  // With the daily devotional on, it opens by itself the first time the app opens each day. Not over the intro or a shared link.
  const devotionalOn = useSettings((s) => s.devotional);
  useEffect(() => {
    if (!DEVOTIONAL || !devotionalOn || route !== '/' || !ready || !installed || pending || !introDone || sheet || shownToday()) return;
    markShownToday();
    useDevotional.setState({ source: 'auto' });
    useUI.getState().open('devotional');
  }, [devotionalOn, route, ready, installed, pending, introDone, sheet]);

  return (
    <>
      {route === '/' && <Reader />}
      {route === '/settings' && <Settings />}
      {route === '/privacy' && <Privacy />}
      {route === '/terms' && <Terms />}
      {route === '/plan' && <Plan />}
      {route === '/progress' && <Progress />}

      {sheet === 'menu' && <MenuSheet />}
      {sheet === 'navigator' && <NavigatorSheet />}
      {sheet === 'text' && <TextSettingsSheet />}
      {sheet === 'note' && <NoteSheet />}
      {sheet === 'compare' && <CompareSheet />}
      {sheet === 'xrefs' && <XrefSheet />}
      {sheet === 'ask' && (
        <ErrorBoundary fallback={(reset) => <AskCrash onRetry={reset} />}>
          <AskSheet />
        </ErrorBoundary>
      )}
      {sheet === 'search' && <SearchSheet />}
      {sheet === 'library' && <LibrarySheet />}
      {sheet === 'study' && <StudySheet />}
      {sheet === 'devotional' && <DevotionalSheet />}
      {sheet === 'install' && <InstallSheet />}
      {sheet === 'feedback' && <FeedbackSheet />}
      {sheet === 'listen' && <ListenSheet />}
      {sheet === 'deleteAccount' && <DeleteAccountSheet />}
      {sheet === 'consent' && <ConsentSheet />}
      {sheet === 'share' && <ShareSheet />}
      {ready && !hasVersions && !introDone && route === '/' && <Intro />}
      <Toast />
    </>
  );
}
