import { create } from 'zustand';
import { BOOKS } from '../data/books';
import { dbAll, dbDelete, dbPut } from '../db';
import { useLibrary } from './library';
import { useSettings } from './settings';
import { loadPosition, savePosition } from './position';
import { trackFeature } from '../analytics';

/** The fifth color is stored as "orange" because that was its name before the palette changed to purple. Highlights, backups and sync keep working. */
export type HlColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
export const HL_COLORS: HlColor[] = ['yellow', 'green', 'blue', 'pink', 'orange'];

export const vkey = (book: string, chapter: number, verse: number) => `${book}.${chapter}.${verse}`;

export interface Highlight {
  key: string;
  book: string;
  chapter: number;
  verse: number;
  color: HlColor;
  /** Text and version at the time of marking, to show in My study. */
  text: string;
  versionId: string;
  createdAt: number;
  /** Last color change. Without it, createdAt applies. */
  updatedAt?: number;
}

export interface Note {
  id: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  text: string;
  excerpt: string;
  versionId: string;
  createdAt: number;
  /** Last edit. Without it, createdAt applies. */
  updatedAt?: number;
}

/** Books of the version in use, in canonical order. With no version installed, the full canon. */
export function currentBooks() {
  const meta = useLibrary.getState().installed[useSettings.getState().versionId];
  if (!meta) return BOOKS.map((b) => ({ id: b.id, chapters: b.chapters }));
  return meta.books;
}

interface StudyStore {
  hydrated: boolean;
  book: string;
  chapter: number;
  focusVerse: number | null;
  /** Last verse of the focused passage. */
  focusTo: number | null;
  selection: number[];
  highlights: Record<string, Highlight>;
  notes: Note[];
  hydrate: () => Promise<void>;
  /** Replaces highlights and notes (backup import). */
  merge: (highlights: Highlight[], notes: Note[]) => Promise<void>;
  goTo: (book: string, chapter: number, verse?: number, to?: number) => void;
  step: (delta: 1 | -1) => boolean;
  toggleVerse: (v: number) => void;
  clearSelection: () => void;
  clearFocus: () => void;
  paint: (color: HlColor, texts: Record<number, string>) => void;
  saveNote: (text: string, excerpt: string, existingId?: string, at?: { book: string; chapter: number; verseStart: number; verseEnd: number }) => void;
  /** Paints or, with a null color, clears the highlight on verses v1 to v2. */
  setColor: (book: string, chapter: number, v1: number, v2: number, color: HlColor | null, texts: Record<number, string>) => void;
  deleteNote: (id: string) => void;
  removeHighlight: (key: string) => void;
}

const start = loadPosition();

const persistFail = () => {
  // A write failure does not break reading. Warning the user is up to the caller, if wanted.
};

export const useStudy = create<StudyStore>((set, get) => ({
  hydrated: false,
  book: start?.book ?? 'gn',
  chapter: start?.chapter ?? 1,
  focusVerse: null,
  focusTo: null,
  selection: [],
  highlights: {},
  notes: [],

  hydrate: async () => {
    try {
      const [hs, ns] = await Promise.all([dbAll<Highlight>('highlights'), dbAll<Note>('notes')]);
      // Highlights made before loading finishes still count.
      set((s) => ({
        highlights: { ...Object.fromEntries(hs.map((h) => [h.key, h])), ...s.highlights },
        notes: [...ns.filter((n) => !s.notes.some((x) => x.id === n.id)), ...s.notes],
        hydrated: true,
      }));
    } catch {
      set({ hydrated: true });
    }
  },

  merge: async (highlights, notes) => {
    const s = get();
    const hl = { ...s.highlights };
    const hstamp = (h: Highlight) => h.updatedAt ?? h.createdAt;
    for (const h of highlights) if (!hl[h.key] || hstamp(hl[h.key]) < hstamp(h)) hl[h.key] = h;
    const byId = new Map(s.notes.map((n) => [n.id, n]));
    const stamp = (n: Note) => n.updatedAt ?? n.createdAt;
    for (const n of notes) if (!byId.has(n.id) || stamp(byId.get(n.id)!) < stamp(n)) byId.set(n.id, n);
    await dbPut('highlights', Object.values(hl));
    await dbPut('notes', [...byId.values()]);
    set({ highlights: hl, notes: [...byId.values()] });
  },

  goTo: (book, chapter, verse, to) => {
    savePosition(book, chapter);
    set({ book, chapter, focusVerse: verse ?? null, focusTo: verse === undefined ? null : (to ?? verse), selection: [] });
  },

  step: (delta) => {
    const { book, chapter } = get();
    const list = currentBooks();
    const i = list.findIndex((b) => b.id === book);
    let nb = i < 0 ? 0 : i;
    let nc = chapter + delta;
    if (i >= 0 && nc > list[i].chapters) {
      nb = i + 1;
      nc = 1;
    } else if (nc < 1) {
      nb = i - 1;
      nc = nb >= 0 ? list[nb].chapters : 0;
    }
    if (nb < 0 || nb >= list.length) return false;
    savePosition(list[nb].id, nc);
    set({ book: list[nb].id, chapter: nc, focusVerse: null, selection: [] });
    return true;
  },

  toggleVerse: (v) =>
    set((s) => ({
      selection: s.selection.includes(v) ? s.selection.filter((x) => x !== v) : [...s.selection, v].sort((a, b) => a - b),
    })),
  clearSelection: () => set({ selection: [] }),
  clearFocus: () => set({ focusVerse: null, focusTo: null }),

  paint: (color, texts) => {
    const { book, chapter, selection, highlights } = get();
    const versionId = useSettings.getState().versionId;
    const keys = selection.map((v) => vkey(book, chapter, v));
    const allSame = keys.every((k) => highlights[k]?.color === color);
    const next = { ...highlights };
    const puts: Highlight[] = [];
    const dels: string[] = [];
    selection.forEach((v, i) => {
      if (allSame) {
        delete next[keys[i]];
        dels.push(keys[i]);
      } else {
        const h: Highlight = { key: keys[i], book, chapter, verse: v, color, text: texts[v] ?? '', versionId, createdAt: Date.now() };
        next[keys[i]] = h;
        puts.push(h);
      }
    });
    set({ highlights: next });
    if (puts.length) {
      trackFeature('highlight');
      dbPut('highlights', puts).catch(persistFail);
    }
    if (dels.length) dbDelete('highlights', dels).catch(persistFail);
  },

  saveNote: (text, excerpt, existingId, at) => {
    const { notes } = get();
    const { book, chapter, selection } = get();
    let saved: Note;
    if (existingId) {
      saved = { ...notes.find((n) => n.id === existingId)!, text, updatedAt: Date.now() };
      set({ notes: notes.map((n) => (n.id === existingId ? saved : n)) });
    } else {
      saved = {
        id: crypto.randomUUID(),
        book: at?.book ?? book,
        chapter: at?.chapter ?? chapter,
        verseStart: at?.verseStart ?? selection[0],
        verseEnd: at?.verseEnd ?? selection[selection.length - 1],
        text,
        excerpt,
        versionId: useSettings.getState().versionId,
        createdAt: Date.now(),
      };
      set({ notes: [...notes, saved] });
      trackFeature('note');
    }
    dbPut('notes', [saved]).catch(persistFail);
  },

  setColor: (book, chapter, v1, v2, color, texts) => {
    const versionId = useSettings.getState().versionId;
    const next = { ...get().highlights };
    const puts: Highlight[] = [];
    const dels: string[] = [];
    for (let v = v1; v <= v2; v++) {
      const key = vkey(book, chapter, v);
      if (!color) {
        if (next[key]) {
          delete next[key];
          dels.push(key);
        }
        continue;
      }
      const h: Highlight = next[key] ? { ...next[key], color, updatedAt: Date.now() } : { key, book, chapter, verse: v, color, text: texts[v] ?? '', versionId, createdAt: Date.now() };
      next[key] = h;
      puts.push(h);
    }
    set({ highlights: next });
    if (puts.length) dbPut('highlights', puts).catch(persistFail);
    if (dels.length) dbDelete('highlights', dels).catch(persistFail);
  },

  removeHighlight: (key) => {
    set((s) => ({ highlights: Object.fromEntries(Object.entries(s.highlights).filter(([k]) => k !== key)) }));
    dbDelete('highlights', [key]).catch(persistFail);
  },

  deleteNote: (id) => {
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    dbDelete('notes', [id]).catch(persistFail);
  },
}));
