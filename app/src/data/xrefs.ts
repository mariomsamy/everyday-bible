/** Cross-references from the Treasury of Scripture Knowledge (public domain), in public/xrefs/<book>.json. */
export type XrefFile = Record<string, string[]>;

export interface Xref {
  book: string;
  chapter: number;
  first: number;
  last: number;
}

// Keep identical to fileOf in scripts/build-xrefs.mjs.
const fileOf = (id: string) => id.replace(/[^\x00-\x7f]/g, (c) => `u${c.charCodeAt(0).toString(16)}`);

const files = new Map<string, Promise<XrefFile>>();

/** Downloads the book's file the first time. The service worker keeps it, so it works offline afterwards. */
export function loadXrefs(bookId: string): Promise<XrefFile> {
  let file = files.get(bookId);
  if (!file) {
    file = fetch(`${import.meta.env.BASE_URL}xrefs/${fileOf(bookId)}.json`).then((r) => {
      if (!r.ok) throw new Error(`xrefs ${bookId}: ${r.status}`);
      return r.json() as Promise<XrefFile>;
    });
    files.set(bookId, file);
    file.catch(() => files.delete(bookId));
  }
  return file;
}

/** "rm.5.8" or "2co.5.19-21". */
export function parseXref(s: string): Xref {
  const [book, chapter, verses] = s.split('.');
  const [first, last] = verses.split('-').map(Number);
  return { book, chapter: Number(chapter), first, last: last ?? first };
}

const MAX_PER_VERSE = 10;
const MAX_TOTAL = 30;

/** References for the selected verses, one per verse per round, without repeats and without pointing back to the selection itself. */
export async function xrefsFor(book: string, chapter: number, verses: number[]): Promise<Xref[]> {
  const file = await loadXrefs(book);
  const lists = verses.map((v) => (file[`${chapter}.${v}`] ?? []).map(parseXref));
  const inSelection = (x: Xref) => x.book === book && x.chapter === chapter && verses.some((v) => v >= x.first && v <= x.last);
  const limit = Math.min(MAX_TOTAL, MAX_PER_VERSE * verses.length);
  const seen = new Set<string>();
  const out: Xref[] = [];
  for (let round = 0; out.length < limit && lists.some((l) => l.length > round); round++) {
    for (const l of lists) {
      const x = l[round];
      if (!x || inSelection(x)) continue;
      const k = `${x.book}.${x.chapter}.${x.first}-${x.last}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
      if (out.length === limit) return out;
    }
  }
  return out;
}
