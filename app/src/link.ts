import { BOOKS } from './data/books';
import { findVersion } from './data/catalog';

export interface ReadLink {
  versionId: string;
  book: string;
  chapter: number;
  /** Chapter passage, when the link points to verses. */
  verses?: { from: number; to: number };
}

const base = import.meta.env.BASE_URL;

/** URL of a reading: /pt_nvi/jn/3, or /pt_nvi/jn/3/16-17 for a passage. */
export const readPath = (versionId: string, book: string, chapter: number, verses?: { from: number; to: number }) =>
  `${base}${versionId}/${book}/${chapter}${verses ? `/${verses.from === verses.to ? verses.from : `${verses.from}-${verses.to}`}` : ''}`;

const REF = 'ref';

/**
 * URL of a passage for the share message: /?ref=pt_nvi/jo/3/16-17.
 * GitHub Pages answers 404 to paths that do not exist, and messaging apps do not build the preview that way.
 * The root with a parameter answers 200, and the app opens the passage from it.
 */
export const shareUrl = (versionId: string, book: string, chapter: number, verses: { from: number; to: number }) => {
  const url = new URL(base, location.origin);
  url.search = `?${REF}=${readPath(versionId, book, chapter, verses).slice(base.length)}`;
  return url.href;
};

/** The reading requested by the URL: the `ref` parameter of shared links or the path itself. */
export function readLinkFromLocation(): ReadLink | null {
  const ref = new URLSearchParams(location.search).get(REF);
  return parseReadPath(ref ? base + ref : location.pathname);
}

/** The URL's query string without the shared link parameter. */
export function searchWithoutRef(): string {
  const params = new URLSearchParams(location.search);
  params.delete(REF);
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** "16" or "16-17". Any other form is ignored, and the link opens only the chapter. */
function parseVerses(s?: string): ReadLink['verses'] {
  const m = /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(s ?? '');
  if (!m) return undefined;
  const from = Number(m[1]);
  const to = m[2] ? Number(m[2]) : from;
  return from >= 1 && to >= from ? { from, to } : undefined;
}

/** Reads a reading URL. An unknown version or book invalidates the link. A chapter out of range becomes the nearest one. */
export function parseReadPath(pathname: string): ReadLink | null {
  if (!pathname.startsWith(base)) return null;
  const [v, b, c, vs] = pathname.slice(base.length).split('/').filter(Boolean).map((x) => decodeURIComponent(x).toLowerCase());
  const book = BOOKS.find((x) => x.id === b);
  if (!v || !book || !findVersion(v)) return null;
  const n = Math.trunc(Number(c));
  const chapter = Number.isFinite(n) ? Math.min(Math.max(n, 1), book.chapters) : 1;
  // If the chapter was adjusted, the passage no longer applies.
  const verses = chapter === n ? parseVerses(vs) : undefined;
  return { versionId: v, book: book.id, chapter, ...(verses && { verses }) };
}

/** App URL, without a reading. This is what the share button sends. */
export const appUrl = () => new URL(base, location.origin).href;

/** URL of the devotional of a day (1-366): /#/devotional/42. It opens the app with the devotional sheet. */
export const devotionalUrl = (dayId: number) => `${appUrl()}#/devotional/${dayId}`;

/** The sheet requested by the URL hash: #/library, #/study, #/devotional or #/devotional/<day ID>. */
export function sheetFromHash(hash: string): { name: 'library' | 'study' | 'devotional'; day?: number } | null {
  if (hash === '#/library') return { name: 'library' };
  if (hash === '#/study') return { name: 'study' };
  const m = /^#\/devotional(?:\/(\d{1,3}))?$/.exec(hash);
  return m ? { name: 'devotional', ...(m[1] && { day: Number(m[1]) }) } : null;
}
