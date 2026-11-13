// Reading position: synchronous mirror in localStorage, so the app opens in the right place.
import { getJson, setJson } from '../storage';

const KEY = 'ob:position';

export function loadPosition(): { book: string; chapter: number } | null {
  const p = getJson<{ book?: unknown; chapter?: unknown } | null>(KEY, null);
  if (p && typeof p.book === 'string' && Number.isInteger(p.chapter) && (p.chapter as number) > 0) return p as { book: string; chapter: number };
  return null;
}

export function savePosition(book: string, chapter: number) {
  setJson(KEY, { book, chapter });
}
