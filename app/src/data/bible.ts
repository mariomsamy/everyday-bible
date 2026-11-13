import { normalize } from '../search';
import { dbDelete, dbDeleteRange, dbGet, dbPut, dbRange } from '../db';

export interface BookText {
  id: string;
  name: string;
  /** chapters[0] is chapter 1; each chapter is a list of verses. */
  chapters: string[][];
}

export interface VersionMeta {
  id: string;
  installedAt: number;
  /** Books present in the version, in canonical order. */
  books: { id: string; name: string; chapters: number }[];
}

const key = (versionId: string, bookId: string) => `${versionId}:${bookId}`;

// Small in-memory cache: the open book and its neighbors.
const cache = new Map<string, BookText>();
const MAX_CACHE = 6;

export async function loadBook(versionId: string, bookId: string): Promise<BookText | undefined> {
  const k = key(versionId, bookId);
  const hit = cache.get(k);
  if (hit) {
    cache.delete(k);
    cache.set(k, hit);
    return hit;
  }
  const book = await dbGet<BookText>('books', k);
  if (book) {
    cache.set(k, book);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  }
  return book;
}

export async function loadAllBooks(versionId: string): Promise<BookText[]> {
  return dbRange<BookText>('books', `${versionId}:`);
}

/** Writes the whole version. The meta goes in last, so an interrupted write never leaves a half "installed" version. */
export async function saveVersion(id: string, books: BookText[], order: (bookId: string) => number): Promise<VersionMeta> {
  await dbDeleteRange('books', `${id}:`);
  await dbPut('books', books, books.map((b) => key(id, b.id)));
  const meta: VersionMeta = {
    id,
    installedAt: Date.now(),
    books: books
      .map((b) => ({ id: b.id, name: b.name, chapters: b.chapters.length }))
      .sort((a, b) => order(a.id) - order(b.id)),
  };
  await dbPut('versions', [meta]);
  return meta;
}

export async function deleteVersion(id: string): Promise<void> {
  await dbDelete('versions', [id]);
  await dbDeleteRange('books', `${id}:`);
  for (const k of [...cache.keys()]) if (k.startsWith(`${id}:`)) cache.delete(k);
  indexed.delete(id);
}

export interface IndexedChapter {
  book: string;
  chapter: number;
  verses: string[];
  /** The same verses without accents and in lowercase, computed once so each search only scans them. */
  norms: string[];
}

const indexed = new Map<string, Promise<IndexedChapter[]>>();

/** All chapters of the version, in the order read from IndexedDB. Kept in memory until `pruneSearchIndex` drops it. */
export function loadSearchIndex(versionId: string): Promise<IndexedChapter[]> {
  let p = indexed.get(versionId);
  if (!p) {
    p = loadAllBooks(versionId).then((books) =>
      books.flatMap((b) =>
        b.chapters.map((verses, i) => ({ book: b.id, chapter: i + 1, verses, norms: verses.map((v) => normalize(v).norm) })),
      ),
    );
    p.catch(() => indexed.delete(versionId));
    indexed.set(versionId, p);
  }
  return p;
}

/** Frees the memory of every version except the ones to keep. */
export function pruneSearchIndex(keep: string[]): void {
  for (const id of [...indexed.keys()]) if (!keep.includes(id)) indexed.delete(id);
}
