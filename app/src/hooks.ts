import { useEffect, useMemo, useState } from 'react';
import { loadBook } from './data/bible';
import { BOOKS, type Book } from './data/books';
import { localBookName } from './i18n/books';
import { useLibrary } from './state/library';
import { useSettings } from './state/settings';

/** Books of the version in use, with the names from the version file. Without an installed version, the canon with names in the interface language. */
export function useBooks(): Book[] {
  const versionId = useSettings((s) => s.versionId);
  const uiLang = useSettings((s) => s.uiLang);
  const meta = useLibrary((s) => s.installed[versionId]);
  return useMemo(() => {
    if (!meta) return BOOKS.map((b, i) => ({ ...b, name: localBookName(uiLang, i) ?? b.name }));
    return meta.books.map((b) => ({
      id: b.id,
      name: b.name,
      chapters: b.chapters,
      testament: BOOKS.find((x) => x.id === b.id)!.testament,
    }));
  }, [meta, uiLang]);
}

export function useBookName() {
  const books = useBooks();
  const uiLang = useSettings((s) => s.uiLang);
  return (id: string) => {
    const i = BOOKS.findIndex((b) => b.id === id);
    return books.find((b) => b.id === id)?.name ?? (i >= 0 ? localBookName(uiLang, i) ?? BOOKS[i].name : id);
  };
}

export type ChapterState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; verses: string[] };

/** Text of a chapter of the version in use, read from IndexedDB. */
export function useChapter(book: string, chapter: number): ChapterState {
  const versionId = useSettings((s) => s.versionId);
  const installed = useLibrary((s) => !!s.installed[versionId]);
  const ready = useLibrary((s) => s.ready);
  const [state, setState] = useState<{ key: string; value: ChapterState }>({ key: '', value: { status: 'loading' } });
  const key = `${versionId}:${book}.${chapter}`;

  useEffect(() => {
    if (!ready) return;
    if (!installed) {
      setState({ key, value: { status: 'missing' } });
      return;
    }
    let live = true;
    loadBook(versionId, book)
      .then((b) => {
        if (!live) return;
        const verses = b?.chapters[chapter - 1];
        setState({ key, value: verses ? { status: 'ready', verses } : { status: 'missing' } });
      })
      .catch(() => live && setState({ key, value: { status: 'missing' } }));
    return () => {
      live = false;
    };
  }, [key, ready, installed, versionId, book, chapter]);

  return state.key === key ? state.value : { status: 'loading' };
}
