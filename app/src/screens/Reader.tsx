import { useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight, List, MagnifyingGlass, NotePencil, SpeakerHigh, SpeakerSlash, TextAa } from '@phosphor-icons/react';
import { abbrOf, findVersion } from '../data/catalog';
import { useBookName, useBooks, useChapter } from '../hooks';
import { useLibrary } from '../state/library';
import { useSettings } from '../state/settings';
import { vkey, useStudy } from '../state/study';
import { useUI } from '../state/ui';
import { readingVars } from '../components/readingVars';
import { SelectionBar } from '../components/SelectionBar';
import { AskBar } from '../components/AskBar';
import { AskFab } from '../components/AskFab';
import { aiEnabled } from '../ai';
import { useAsk } from '../state/ask';
import { InstallBanner } from '../components/InstallBanner';
import { Button } from '../components/Button';
import { SwipeHint } from '../components/SwipeHint';
import { SilentHint } from '../components/SilentHint';
import { Welcome } from '../components/Welcome';
import { useIncoming } from '../state/incoming';
import { hintPending, markHintSeen } from '../hint';
import { isMobile } from '../install';
import { ListenBar } from '../components/ListenBar';
import { listenSupported, resume, setSilentHandler, markSilentHintSeen, silentHintDue, start, stop, useListen } from '../listen';
import { trackFeature } from '../analytics';
import { useT } from '../i18n';
import { ReadMark } from '../components/ReadMark';
import { PlanStrip } from '../components/PlanStrip';

export function Reader() {
  const t = useT();
  const { book, chapter, selection, highlights, notes, focusVerse, focusTo, step, toggleVerse, clearFocus } = useStudy();
  const settings = useSettings();
  const { sheet, open, notify } = useUI();
  const askBar = useAsk((s) => s.bar) && aiEnabled;
  const [barMini, setBarMini] = useState(false);
  const [hint, setHint] = useState(false);
  const [silentHint, setSilentHint] = useState(false);
  /** Verse that receives Tab: only one per chapter, arrows move between them. */
  const [tabV, setTabV] = useState(1);
  const [dir, setDir] = useState<'next' | 'prev' | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // In a right-to-left interface the next page is to the left, like turning a printed Arabic book.
  const flip = settings.uiLang === 'ar' ? -1 : 1;
  // Buttons inside the text block follow the interface direction, not the direction of the Bible version.
  const uiDir = settings.uiLang === 'ar' ? 'rtl' : 'ltr';

  const listenStatus = useListen((s) => s.status);
  const listenVerse = useListen((s) => s.verse);
  const advancing = useListen((s) => s.advancing);

  const books = useBooks();
  const bookName = useBookName();
  const installed = useLibrary((s) => !!s.installed[settings.versionId]);
  const awaitingLink = useIncoming((s) => s.incoming !== null);
  const libraryReady = useLibrary((s) => s.ready);
  const text = useChapter(book, chapter);
  const verses = text.status === 'ready' ? text.verses : [];
  const bName = bookName(book);
  const versionInfo = findVersion(settings.versionId);
  const hasSelection = selection.length > 0;
  const blocked = hasSelection || sheet !== null;

  const toggleListen = () => {
    if (listenStatus !== 'idle') return stop();
    if (silentHintDue()) return setSilentHint(true);
    if (!start(verses, versionInfo?.lang ?? 'en')) notify(t('listenNoVoice'));
    else trackFeature('listen');
  };

  // Tapping the silent mode notice starts playback, already inside the user gesture.
  const confirmSilentHint = () => {
    markSilentHintSeen();
    if (!start(verses, versionInfo?.lang ?? 'en')) notify(t('listenNoVoice'));
    else trackFeature('listen');
  };

  const move = (delta: 1 | -1) => {
    if (blocked) return;
    if (step(delta)) {
      markHintSeen();
      setDir(delta === 1 ? 'next' : 'prev');
      scrollTo(0, 0);
    } else {
      notify(delta === 1 ? t('lastChapter') : t('firstChapter'));
    }
  };

  // The saved position may not exist in the current version (for example, an NT-only version).
  useEffect(() => {
    if (!installed || books.some((x) => x.id === book && chapter <= x.chapters)) return;
    const target = books.find((x) => x.id === book) ?? books[0];
    if (target) useStudy.getState().goTo(target.id, 1);
  }, [installed, books, book, chapter]);

  // Changing chapter manually stops playback. When playback advances by itself, it continues in the new text.
  useEffect(() => {
    const l = useListen.getState();
    if (l.status !== 'idle' && !l.advancing) stop();
  }, [book, chapter]);

  useEffect(() => setTabV(1), [book, chapter]);

  useEffect(() => {
    if (!advancing) return;
    if (text.status === 'ready' && verses.length) resume(verses, versionInfo?.lang ?? 'en');
    else if (text.status !== 'loading') stop();
  }, [advancing, text.status, verses, versionInfo?.lang]);

  useEffect(() => {
    setSilentHandler(() => notify(t('listenSilent')));
  }, [notify, t]);
  useEffect(() => () => stop(), []);

  // Follows the verse being read, without scrolling if it is already in view.
  useEffect(() => {
    if (listenVerse === null) return;
    const el = document.getElementById(`v-${listenVerse}`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 110 || r.bottom > innerHeight - 110) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [listenVerse]);

  // Collapsible bar: hides on scroll down, returns on scroll up.
  useEffect(() => {
    let last = scrollY;
    const onScroll = () => {
      const y = scrollY;
      if (y < 60) setBarMini(false);
      else if (y > last + 8) setBarMini(true);
      else if (y < last - 8) setBarMini(false);
      last = y;
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!installed) return;
      if (e.key === 'ArrowRight') move(flip === 1 ? 1 : -1);
      if (e.key === 'ArrowLeft') move(flip === 1 ? -1 : 1);
      if (e.key === 'Escape') useStudy.getState().clearSelection();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  // Comes from My study with a verse in focus
  useEffect(() => {
    if (focusVerse === null) return;
    if (text.status === 'loading') return;
    const el = document.getElementById(`v-${focusVerse}`);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      // Closing the sheet that sent us here pops its history entry, and the browser then restores that entry's scroll position.
      const again = () => requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }));
      addEventListener('popstate', again, { once: true });
      setTimeout(() => removeEventListener('popstate', again), 1000);
      for (let v = focusVerse; v <= (focusTo ?? focusVerse); v++) document.getElementById(`v-${v}`)?.classList.add('flash');
    }
    clearFocus();
  }, [focusVerse, focusTo, clearFocus, book, chapter, text.status]);

  // The selection sheet can cover the tapped verse: scroll it to the middle of the visible area above the sheet
  const prevSel = useRef<number[]>([]);
  useEffect(() => {
    const added = selection.filter((v) => !prevSel.current.includes(v));
    prevSel.current = selection;
    const target = added[added.length - 1];
    if (target === undefined) return;
    const id = setTimeout(() => {
      const el = document.getElementById(`v-${target}`);
      const sheet = document.querySelector('.sheet.modeless');
      if (!el || !sheet) return;
      const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
      const bottom = sheet.getBoundingClientRect().top;
      const r = el.getBoundingClientRect();
      if (r.bottom <= bottom - 16 && r.top >= top) return;
      const dy = r.top + r.height / 2 - (top + bottom) / 2;
      window.scrollBy({ top: dy, behavior: 'smooth' });
    }, 260);
    return () => clearTimeout(id);
  }, [selection]);

  // Gesture hint only on first launch. Counts as seen when it appears or when the user already changes chapter.
  useEffect(() => {
    if (!installed || !isMobile() || !hintPending()) return;
    const id = setTimeout(() => {
      if (!hintPending()) return;
      setHint(true);
      markHintSeen();
    }, 700);
    return () => clearTimeout(id);
  }, [installed]);

  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(((dx < 0 ? 1 : -1) * flip) as 1 | -1);
  };

  const onPageClick = (e: React.MouseEvent) => {
    if (e.clientY < 90) setBarMini(false);
    const target = e.target as HTMLElement;
    const el = target.closest<HTMLElement>('[data-v]');
    if (el && target.closest('.note-mark')) {
      // The note icon opens editing directly, with only that verse selected.
      const study = useStudy.getState();
      study.clearSelection();
      study.toggleVerse(Number(el.dataset.v));
      open('note');
    } else if (el) toggleVerse(Number(el.dataset.v));
    else if (hasSelection) useStudy.getState().clearSelection();
  };

  const noteAt = (v: number) => notes.some((n) => n.book === book && n.chapter === chapter && v >= n.verseStart && v <= n.verseEnd);

  if (libraryReady && (!installed || awaitingLink)) return <Welcome />;

  return (
    <div className="reader">
      <header className={`topbar ${barMini && !blocked ? 'mini' : ''}`}>
        <div className="topbar-in">
          <button className="mini-title" onClick={() => setBarMini(false)} aria-label={t('showBar', { ref: `${bName} ${chapter}`, abbr: abbrOf(settings.versionId) })} tabIndex={barMini && !blocked ? 0 : -1}>
            <span>{bName} {chapter}</span><i aria-hidden="true" /><span>{abbrOf(settings.versionId)}</span>
          </button>
          <button className="crumb" onClick={() => open('navigator')} aria-label={t('pickBook', { ref: `${bName} ${chapter}` })}>
            <span>{bName} {chapter}</span>
          </button>
          <button className="ver-chip" onClick={() => open('library')} aria-label={t('chooseVersion')}>
            {abbrOf(settings.versionId)}
          </button>
          <span className="spacer" />
          <button className="icon-btn" onClick={() => open('search')} aria-label={t('search')}><MagnifyingGlass size={24} weight="light" /></button>
          {listenSupported() && (
            <button className="icon-btn" onClick={toggleListen} aria-label={listenStatus !== 'idle' ? t('listenStop') : t('listen')}>
              {listenStatus !== 'idle' ? <SpeakerSlash size={24} weight="light" /> : <SpeakerHigh size={24} weight="light" />}
            </button>
          )}
          <button className="icon-btn" onClick={() => open('text')} aria-label={t('textSettings')}><TextAa size={24} weight="light" /></button>
          <button className="icon-btn" onClick={() => open('menu')} aria-label={t('menu')}><List size={24} weight="light" /></button>
        </div>
      </header>

      <button className="edge left" hidden={blocked} onClick={() => move(-flip as 1 | -1)} aria-label={t(flip === 1 ? 'prevChapter' : 'nextChapter')}><CaretLeft size={28} weight="light" /></button>
      <button className="edge right" hidden={blocked} onClick={() => move(flip as 1 | -1)} aria-label={t(flip === 1 ? 'nextChapter' : 'prevChapter')}><CaretRight size={28} weight="light" /></button>

      <main
        className={`page${(hasSelection || askBar) && (!sheet || sheet === 'ask') ? ' has-sel' : ''}`}
        style={readingVars(settings)}
        onClick={onPageClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <PlanStrip />
        <article
          key={`${book}.${chapter}`}
          className={`chapter ${dir ? `anim-${dir}` : ''} ${settings.textMode === 'verses' ? 'verses' : 'paragraph'} vn-${settings.verseNumbers}`}
          lang={versionInfo?.lang}
          dir={versionInfo?.rtl ? 'rtl' : undefined}
        >
          <h1 className="chapter-title">
            <span className="bk">{bName}</span>
            <span className="nr">{chapter}</span>
          </h1>
          {text.status === 'missing' && installed && <p className="chapter-note">{t('chapterMissing')}</p>}
          {text.status === 'ready' && verses.length === 0 && <p className="chapter-note">{t('chapterEmpty')}</p>}
          {verses.map((text, i) => {
            const v = i + 1;
            if (!text) return null; // numbering gap in the source text
            const hl = highlights[vkey(book, chapter, v)];
            const cls = ['verse', hl ? `hl c-${hl.color}` : '', selection.includes(v) ? 'sel' : '', listenStatus !== 'idle' && listenVerse === v ? 'speaking' : ''].join(' ');
            return (
              <span
                key={v}
                data-v={v}
                className="verse-wrap"
                role="button"
                tabIndex={v === Math.min(tabV, verses.length) ? 0 : -1}
                aria-pressed={selection.includes(v)}
                onFocus={() => setTabV(v)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleVerse(v);
                  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    document.getElementById(`v-${v + (e.key === 'ArrowDown' ? 1 : -1)}`)?.parentElement?.focus();
                  }
                }}
              >
                <span id={`v-${v}`} className={cls}>
                  <span className="vn">{v}</span>
                  {text}
                  {noteAt(v) && <NotePencil className="note-mark" size={14} weight="fill" role="img" aria-label={t('hasNote')} />}
                </span>{' '}
              </span>
            );
          })}
          {text.status === 'ready' && verses.length > 0 && <div className="read-mark" dir={uiDir}><ReadMark book={book} chapter={chapter} /></div>}
          <div className="chapter-foot" dir={uiDir}>
            <Button block icon={CaretLeft} iconClass="flip" iconWeight="light" onClick={() => move(-1)}>{t('prev')}</Button>
            <Button block icon={CaretRight} iconClass="flip" iconSide="right" iconWeight="light" onClick={() => move(1)}>{t('next')}</Button>
          </div>
        </article>
        {versionInfo && (
          <footer className="copyright">
            {(([before, after]) => (
              <>
                {before}
                <a href="https://recipe.codes" target="_blank" rel="noopener noreferrer">Recipe Codes</a>
                {after}
              </>
            ))(t('copyright').split('{brand}'))}
          </footer>
        )}
      </main>

      {silentHint && <SilentHint onConfirm={confirmSilentHint} onDone={() => setSilentHint(false)} />}
      {hint && <SwipeHint withAi={aiEnabled} onDone={() => setHint(false)} />}
      {listenStatus !== 'idle' && !hasSelection && !askBar && sheet !== 'menu' && <ListenBar />}
      <InstallBanner hidden={blocked || listenStatus !== 'idle'} hold={hint} />
      {hasSelection && !sheet && !askBar && <SelectionBar />}
      {askBar && (!sheet || sheet === 'ask') && <AskBar />}
      {aiEnabled && !askBar && !hasSelection && !sheet && <AskFab />}
    </div>
  );
}
