import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CaretRight, Check, MagnifyingGlass, Sparkle } from '@phosphor-icons/react';
import { SearchField } from './SearchField';
import { Sheet } from './Sheet';
import { loadSearchIndex, pruneSearchIndex, type IndexedChapter } from '../data/bible';
import { abbrOf } from '../data/catalog';
import { useBookName, useBooks } from '../hooks';
import { highlightRanges, minChars, PAGE_SIZE, parseReference, searchVerses, type Hit } from '../search';
import { useLibrary } from '../state/library';
import { trackFeature } from '../analytics';
import { Chip } from './Chip';
import { Row } from './Row';
import { useSettings } from '../state/settings';
import { useStudy } from '../state/study';
import { useUI } from '../state/ui';
import { go } from '../router';
import { refLabel } from '../ref';
import { useT } from '../i18n';
import { useScrollFade } from '../useScrollFade';
import { aiEnabled, type AiPassage } from '../ai';
import { looksLikePrompt } from '../aiSearch';
import { useAsk } from '../state/ask';
import { Empty } from './Empty';

function Highlighted({ hit, query }: { hit: Hit; query: string }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  highlightRanges(query, hit.text).forEach(([a, b], i) => {
    parts.push(hit.text.slice(at, a), <mark key={i}>{hit.text.slice(a, b)}</mark>);
    at = b;
  });
  parts.push(hit.text.slice(at));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}

const watchOnline = (cb: () => void) => {
  addEventListener('online', cb);
  addEventListener('offline', cb);
  return () => {
    removeEventListener('online', cb);
    removeEventListener('offline', cb);
  };
};
const useOnline = () => useSyncExternalStore(watchOnline, () => navigator.onLine, () => true);

/** Versions included in the search. Kept while the app is open, so reopening the search keeps the choice. */
let sessionSelection: string[] = [];
/** Last search, kept while the app is open so reopening the sheet shows the same results. Gone on reload. */
let sessionQuery = '';
let sessionLimit = PAGE_SIZE;

export function SearchSheet() {
  const t = useT();
  const close = useUI((s) => s.close);
  const notify = useUI((s) => s.notify);
  const goTo = useStudy((s) => s.goTo);
  const versionId = useSettings((s) => s.versionId);
  const setSetting = useSettings((s) => s.set);
  const installed = useLibrary((s) => s.installed);
  const [q, setQ] = useState(sessionQuery);
  const dq = useDeferredValue(q);
  const [limit, setLimit] = useState(sessionLimit);
  sessionQuery = q;
  sessionLimit = limit;

  const books = useBooks();
  const bookName = useBookName();
  const chipsRow = useScrollFade<HTMLDivElement>();

  // Installed versions, the active one first. The selection only keeps versions that are still installed.
  const versions = useMemo(
    () => Object.keys(installed).sort((a, b) => Number(b === versionId) - Number(a === versionId) || a.localeCompare(b)),
    [installed, versionId],
  );
  const [picked, setPicked] = useState<string[]>(sessionSelection);
  const selected = useMemo(() => {
    const kept = versions.filter((v) => picked.includes(v));
    return kept.length > 0 ? kept : [versionId];
  }, [versions, picked, versionId]);
  const key = selected.join(',');

  const toggle = (id: string) => {
    trackFeature('search_versions');
    const next = selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id];
    if (next.length === 0) return;
    sessionSelection = next;
    setPicked(next);
  };

  // Reads the selected versions from IndexedDB, only the ones not in memory yet.
  const [indexes, setIndexes] = useState<Record<string, IndexedChapter[]>>({});
  useEffect(() => {
    let live = true;
    selected.forEach((id) =>
      loadSearchIndex(id)
        .then((c) => live && setIndexes((x) => (x[id] === c ? x : { ...x, [id]: c })))
        .catch(() => live && setIndexes((x) => ({ ...x, [id]: [] }))),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // Closing the search frees the other versions from memory.
  useEffect(() => () => pruneSearchIndex([useSettings.getState().versionId]), []);

  // Null while some selected version is still loading.
  const chapters = useMemo(() => (selected.every((id) => indexes[id]) ? selected : null), [selected, indexes]);
  const multi = selected.length > 1;
  // With more than one version installed, every result names its version, even when only one is selected.
  const showVersion = versions.length > 1;

  const ref = useMemo(() => parseReference(dq, books), [dq, books]);
  const hits = useMemo(
    () => (chapters ? searchVerses(dq, chapters.map((id) => ({ versionId: id, chapters: indexes[id] })), versionId) : []),
    [dq, chapters, indexes, versionId],
  );
  const shown = hits.slice(0, limit);

  // A new search goes back to the first page.
  const lastQuery = useRef(`${dq}|${key}`);
  useEffect(() => {
    const id = `${dq}|${key}`;
    if (lastQuery.current === id) return;
    lastQuery.current = id;
    setLimit(PAGE_SIZE);
  }, [dq, key]);

  const open = (book: string, chapter: number, verse?: number, version = versionId, to?: number) => {
    // Scroll first: the verse focus triggered by goTo scrolls to the verse and must not be undone.
    scrollTo(0, 0);
    if (version !== versionId) {
      setSetting('versionId', version);
      notify(t('versionToast', { abbr: abbrOf(version) }));
    }
    goTo(book, chapter, verse, to);
    close();
    go('/');
  };

  /** Book name as the version of the result calls it, so each result reads in its own language. */
  const nameIn = (id: string, book: string) => installed[id]?.books.find((b) => b.id === book)?.name ?? bookName(book);

  // Typed reference in each selected version that has it. A verse shows its text, a range adds the verse numbers,
  // and a whole chapter has no preview, so its card says where it goes.
  const passages = useMemo((): { id: string; text: React.ReactNode[] | null }[] => {
    if (!ref) return [];
    const { verse, verseEnd } = ref;
    return selected.flatMap((id): { id: string; text: React.ReactNode[] | null }[] => {
      const verses = indexes[id]?.find((c) => c.book === ref.book.id && c.chapter === ref.chapter)?.verses;
      if (!verses) return [];
      if (verse === undefined) return [{ id, text: null }];
      const last = Math.min(verseEnd ?? verse, verses.length);
      const parts: React.ReactNode[] = [];
      for (let v = verse; v <= last; v++) {
        parts.push(
          <Fragment key={v}>
            {v > verse && ' '}
            {last > verse && <sup>{v} </sup>}
            {verses[v - 1]}
          </Fragment>,
        );
      }
      return parts.length ? [{ id, text: parts }] : [];
    });
  }, [ref, selected, indexes]);

  // A sentence, not keywords: the field offers it to the AI. Nothing is sent before the reader confirms.
  const uiLang = useSettings((s) => s.uiLang);
  const online = useOnline();
  const canAsk = aiEnabled && online && !ref && q.trim().length >= 3;
  const asking = canAsk && looksLikePrompt(q, uiLang);
  const askAi = () => {
    const question = q.trim();
    if (!canAsk || !question) return;
    trackFeature('ask_search');
    const passage: AiPassage = { ref: '', version: abbrOf(versionId), text: '', topic: true };
    useAsk.getState().start(question, passage, uiLang);
    useUI.getState().open('ask');
  };

  const typed = dq.trim().length >= minChars(dq);
  const tooShort = !typed && dq.trim().length > 0;

  return (
    <Sheet
      title={t('search')}
      icon={MagnifyingGlass}
      onClose={close}
      tall
      pinned={
        <>
        <SearchField
          autoFocus
          dictate={{ onStart: () => trackFeature('search_dictation') }}
          value={q}
          onChange={setQ}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
          enterKeyHint={asking ? 'send' : 'search'}
          ask={canAsk ? { active: asking, label: t('searchAsk'), onAsk: askAi } : undefined}
          autoCapitalize="none"
          autoCorrect="off"
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            // A recognized reference opens the passage; otherwise it dismisses the keyboard to show the results.
            if (ref) open(ref.book.id, ref.chapter, ref.verse);
            else if (asking) askAi();
            else e.currentTarget.blur();
          }}
        />
        {versions.length > 1 && (
          <div className="vchips" ref={chipsRow} role="group" aria-label={t('searchVersions')}>
            {versions.map((id) => {
              const on = selected.includes(id);
              return (
                <button key={id} className="chip-btn" aria-pressed={on} onClick={() => toggle(id)}>
                  {on && <Check size={14} weight="bold" aria-hidden="true" />}
                  {abbrOf(id)}
                </button>
              );
            })}
          </div>
        )}
        </>
      }
    >
      {ref && (passages.length > 0 ? passages : [{ id: versionId, text: null }]).map((p, i) =>
        p.text ? (
          <button
            key={p.id}
            className="entry hit goto"
            style={i > 0 ? { marginTop: 0 } : undefined}
            onClick={() => open(ref.book.id, ref.chapter, ref.verse, p.id, ref.verseEnd)}
          >
            <div className="ref">
              <span className="goto-ref">{refLabel(nameIn(p.id, ref.book.id), ref.chapter, ref.verse, ref.verseEnd)}</span>
              {showVersion && <Chip>{abbrOf(p.id)}</Chip>}
              <CaretRight size={16} weight="light" color="var(--muted)" className="goto-caret flip" />
            </div>
            <p className="txt">{p.text}</p>
          </button>
        ) : (
          <Row
            key={p.id}
            className="goto"
            style={i > 0 ? { marginTop: 8 } : undefined}
            eyebrow={t('goTo')}
            title={
              <>
                {refLabel(nameIn(p.id, ref.book.id), ref.chapter, ref.verse, ref.verseEnd)}
                {showVersion && <Chip className="ml-8">{abbrOf(p.id)}</Chip>}
              </>
            }
            onClick={() => open(ref.book.id, ref.chapter, ref.verse, p.id, ref.verseEnd)}
            end={<CaretRight className="flip" size={18} weight="light" color="var(--muted)" />}
          />
        ),
      )}

      {!typed && !ref && (
        <Empty compact icon={MagnifyingGlass} iconSize={36} hint={t('searchExamples')}>
          {tooShort ? t('searchMin', { n: minChars(dq) }) : t('searchEmpty')}
        </Empty>
      )}

      {typed && chapters === null && <Empty compact>{t('searchPreparing')}</Empty>}

      {asking && (
        <button className="row goto" onClick={askAi}>
          <Sparkle size={24} weight="light" />
          <span className="grow">
            <span className="sub">{t('searchAskEyebrow')}</span>
            <span className="title">{t('searchAskHint')}</span>
          </span>
        </button>
      )}

      {typed && chapters !== null && hits.length === 0 && !ref && !asking && (
        <Empty compact hint={t('searchNoneHint')}>{t('searchNone', { q: dq.trim() })}</Empty>
      )}

      {hits.length > 0 && (
        <>
          <p className="hint" role="status">
            {shown.length < hits.length ? t('searchShown', { n: shown.length, total: hits.length }) : t.n('result', hits.length)}
            {multi && ` ${t('searchInVersions', { n: selected.length })}`}
          </p>
          {shown.map((h) => (
            <button key={`${h.versionId}.${h.book}.${h.chapter}.${h.verse}`} className="entry hit" onClick={() => open(h.book, h.chapter, h.verse, h.versionId)}>
              <div className="ref">
                {refLabel(nameIn(h.versionId, h.book), h.chapter, h.verse)}
                {showVersion && <Chip>{abbrOf(h.versionId)}</Chip>}
              </div>
              <p className="txt"><Highlighted hit={h} query={dq} /></p>
            </button>
          ))}
          {shown.length < hits.length && (
            <button className="row center" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              {t('searchMore')}
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}
