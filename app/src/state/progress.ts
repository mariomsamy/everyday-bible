import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { BOOKS } from '../data/books';
import { loadBook } from '../data/bible';
import { track } from '../analytics';
import { getJson, setJson } from '../storage';
import { isoDate, key, makePlan, parseKey, replan, status, streak, type ChapterRef, type Plan, type Scope, type Status } from '../progress/plan';

/** Reading progress and plan. Stored only on this device (localStorage); never uploaded as a list of chapters. */
const KEY = 'ob:progress';
const SCHEMA = 1;

export const TOTAL_CHAPTERS = BOOKS.reduce((s, b) => s + b.chapters, 0);

interface Saved { v: number; read: Record<string, string>; plan: Plan | null }

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const known = new Map(BOOKS.map((b) => [b.id, b.chapters]));
const validKey = (k: unknown): k is string => {
  if (typeof k !== 'string') return false;
  const { book, chapter } = parseKey(k);
  return known.has(book) && Number.isInteger(chapter) && chapter >= 1 && chapter <= known.get(book)!;
};

/** Accepts anything (saved data or an imported backup) and keeps only what is valid. */
export function sanitize(raw: unknown): { read: Record<string, string>; plan: Plan | null } {
  const o = (raw ?? {}) as Partial<Saved>;
  const read: Record<string, string> = {};
  if (o.read && typeof o.read === 'object') {
    for (const [k, d] of Object.entries(o.read)) if (validKey(k) && isDate(d)) read[k] = d;
  }
  let plan: Plan | null = null;
  const p = o.plan as Plan | null | undefined;
  if (
    p && isDate(p.start) && Number.isInteger(p.days) && p.days >= 1 && p.days <= 3650 &&
    ['all', 'canon', 'ot', 'nt'].includes(p.scope) &&
    Array.isArray(p.chapters) && p.chapters.length > 0 && p.chapters.length <= 2000 && p.chapters.every(validKey) &&
    Array.isArray(p.ends) && p.ends.length === p.days && p.ends.every((e, i) => Number.isInteger(e) && e >= 0 && e <= p.chapters.length && e >= (p.ends[i - 1] ?? 0)) &&
    p.ends.at(-1) === p.chapters.length
  ) {
    plan = { scope: p.scope, start: p.start, days: p.days, chapters: p.chapters, ends: p.ends };
  }
  return { read, plan };
}

function load() {
  return sanitize(getJson<unknown>(KEY, null));
}

interface ProgressStore {
  read: Record<string, string>;
  plan: Plan | null;
  mark: (book: string, chapter: number, date?: string) => void;
  markMany: (keys: string[], date?: string) => void;
  unmark: (book: string, chapter: number) => void;
  setPlan: (plan: Plan | null) => void;
  replace: (data: { read: Record<string, string>; plan: Plan | null }) => void;
  reset: () => void;
}

let snapshotTimer: ReturnType<typeof setTimeout> | undefined;

/** Sends one anonymous summary (counts only) a few seconds after the last change. */
function snapshot() {
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => {
    const { read, plan } = useProgress.getState();
    const dates = Object.values(read);
    const today = isoDate();
    const st = plan ? status(plan, read, today) : null;
    track('progress', {
      read: dates.length,
      pct: Math.round((dates.length / TOTAL_CHAPTERS) * 1000) / 10,
      streak: streak(dates, today),
      plan_days: plan?.days ?? 0,
      pace: st?.pace ?? 'none',
    });
  }, 4000);
}

export const useProgress = create<ProgressStore>((set, get) => {
  const persist = () => {
    const { read, plan } = get();
    setJson(KEY, { v: SCHEMA, read, plan } satisfies Saved);
  };
  return {
    ...load(),
    mark: (book, chapter, date = isoDate()) => get().markMany([key(book, chapter)], date),
    markMany: (keys, date = isoDate()) => {
      const fresh = keys.filter((k) => validKey(k) && !get().read[k]);
      if (fresh.length === 0) return;
      const read = { ...get().read };
      for (const k of fresh) read[k] = date;
      set({ read });
      persist();
      for (const k of fresh) track('chapter_read', { book: parseKey(k).book });
      snapshot();
    },
    unmark: (book, chapter) => {
      const k = key(book, chapter);
      if (!get().read[k]) return;
      const { [k]: _gone, ...read } = get().read;
      set({ read });
      persist();
      snapshot();
    },
    setPlan: (plan) => {
      set({ plan });
      persist();
      if (plan) track('plan_created', { days: plan.days, scope: plan.scope });
      snapshot();
    },
    replace: (data) => {
      set(data);
      persist();
    },
    reset: () => {
      set({ read: {}, plan: null });
      persist();
    },
  };
});

/** Today's date, refreshed when the app comes back to the foreground (so the plan rolls over at midnight). */
export function useToday(): string {
  const [today, setToday] = useState(isoDate());
  useEffect(() => {
    const update = () => setToday(isoDate());
    document.addEventListener('visibilitychange', update);
    const id = setInterval(update, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', update);
      clearInterval(id);
    };
  }, []);
  return today;
}

export function usePlanStatus(): { plan: Plan | null; st: Status | null; today: string } {
  const plan = useProgress((s) => s.plan);
  const read = useProgress((s) => s.read);
  const today = useToday();
  const st = useMemo(() => (plan ? status(plan, read, today) : null), [plan, read, today]);
  return { plan, st, today };
}

const inScope = (scope: Scope, testament: string) =>
  scope === 'all' || (scope === 'canon') || (scope === 'ot' && testament === 'AT') || (scope === 'nt' && testament === 'NT');

/** Chapters of the scope with their verse counts, read from the installed version (verse counts balance the days). */
export async function chapterRefs(versionId: string, bookIds: string[], scope: Scope): Promise<ChapterRef[]> {
  const out: ChapterRef[] = [];
  for (const b of BOOKS) {
    if (!bookIds.includes(b.id) || !inScope(scope, b.testament)) continue;
    const text = await loadBook(versionId, b.id);
    if (!text) continue;
    text.chapters.forEach((verses, i) => out.push({ book: b.id, chapter: i + 1, verses: Math.max(1, verses.length) }));
  }
  return out;
}

export async function createPlan(versionId: string, bookIds: string[], scope: Scope, days: number, start = isoDate()): Promise<Plan> {
  const refs = await chapterRefs(versionId, bookIds, scope);
  const plan = makePlan(refs, scope, days, start);
  useProgress.getState().setPlan(plan);
  return plan;
}

/** Re-spreads the unread chapters of the current plan over `days`, starting today. */
export async function catchUp(versionId: string, days: number): Promise<Plan | null> {
  const { plan, read } = useProgress.getState();
  if (!plan) return null;
  const vol = new Map<string, number>();
  for (const b of new Set(plan.chapters.map((k) => parseKey(k).book))) {
    const text = await loadBook(versionId, b);
    text?.chapters.forEach((v, i) => vol.set(key(b, i + 1), v.length));
  }
  const next = replan(plan, new Set(Object.keys(read)), days, isoDate(), (k) => vol.get(k) ?? 1);
  useProgress.getState().setPlan(next);
  return next;
}
