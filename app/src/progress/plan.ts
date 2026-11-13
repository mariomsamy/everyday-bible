// Reading plan and progress maths. Pure functions, no app imports, so they can be unit-tested with node --test.

export type Scope = 'all' | 'canon' | 'ot' | 'nt';

export interface ChapterRef {
  book: string;
  chapter: number;
  /** Number of verses, used to balance the days by reading time. */
  verses: number;
}

export interface Plan {
  scope: Scope;
  /** Local date (YYYY-MM-DD) of the first day. */
  start: string;
  days: number;
  /** "book.chapter" keys in reading order. */
  chapters: string[];
  /** ends[d] = how many chapters are done at the end of day d (0-based). Non-decreasing, last = chapters.length. */
  ends: number[];
}

export const MAX_DAYS = 3650;
export const key = (book: string, chapter: number) => `${book}.${chapter}`;
export const parseKey = (k: string): { book: string; chapter: number } => {
  const i = k.lastIndexOf('.');
  return { book: k.slice(0, i), chapter: Number(k.slice(i + 1)) };
};

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Whole days from a to b (both YYYY-MM-DD), DST-safe. */
export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

/**
 * Splits `chapters` into `days` consecutive groups of similar reading load (verse count).
 * Each day gets at least one chapter while chapters remain; if days > chapters, the extra days are rest days.
 */
export function splitDays(chapters: ChapterRef[], days: number): number[] {
  const n = chapters.length;
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) throw new RangeError('days out of range');
  const total = chapters.reduce((s, c) => s + c.verses, 0);
  const ends: number[] = [];
  let i = 0;
  let acc = 0;
  for (let d = 0; d < days; d++) {
    const target = (total * (d + 1)) / days;
    // Leave at least one chapter for every remaining day, as long as chapters remain.
    const remainingDays = days - d - 1;
    const maxEnd = Math.min(n, Math.max(i + 1, n - remainingDays));
    // Always advance at least one chapter if any remain and this day is not a forced rest day.
    if (i < n && i < maxEnd) { acc += chapters[i].verses; i++; }
    while (i < maxEnd && acc + chapters[i].verses / 2 <= target) { acc += chapters[i].verses; i++; }
    ends.push(d === days - 1 ? n : i);
  }
  return ends;
}

export function makePlan(chapters: ChapterRef[], scope: Scope, days: number, start: string): Plan {
  if (chapters.length === 0) throw new RangeError('no chapters');
  return { scope, start, days, chapters: chapters.map((c) => key(c.book, c.chapter)), ends: splitDays(chapters, days) };
}

/** 0-based day index for `today`. Negative before the start; >= days after the end. */
export const dayIndex = (plan: Plan, today: string) => daysBetween(plan.start, today);

/** Chapter keys assigned to day `d` (0-based). */
export function dayChapters(plan: Plan, d: number): string[] {
  if (d < 0 || d >= plan.days) return [];
  return plan.chapters.slice(d === 0 ? 0 : plan.ends[d - 1], plan.ends[d]);
}

export type Pace = 'notStarted' | 'ahead' | 'onTrack' | 'behind' | 'done' | 'ended';

export interface Status {
  d: number;
  today: string[];
  todayDone: number;
  total: number;
  read: number;
  /** Chapters that should be finished by the end of yesterday. */
  due: number;
  /** read - due; negative = behind. */
  diff: number;
  pace: Pace;
  /** Unread chapters assigned up to and including today. */
  overdue: string[];
  daysLeft: number;
}

/** `read` holds "book.chapter" keys the person has finished, in any order. */
export function status(plan: Plan, read: ReadonlySet<string> | Record<string, unknown>, today: string): Status {
  const has = (k: string) => (read instanceof Set ? read.has(k) : Object.prototype.hasOwnProperty.call(read, k));
  const d = dayIndex(plan, today);
  const total = plan.chapters.length;
  const readCount = plan.chapters.reduce((s, k) => s + (has(k) ? 1 : 0), 0);
  const dd = Math.min(Math.max(d, 0), plan.days - 1);
  const todayKeys = d >= 0 && d < plan.days ? dayChapters(plan, d) : [];
  const due = d <= 0 ? 0 : plan.ends[Math.min(d, plan.days) - 1];
  const dueNow = d < 0 ? 0 : d >= plan.days ? total : plan.ends[dd];
  const overdue = plan.chapters.slice(0, dueNow).filter((k) => !has(k));
  let pace: Pace;
  if (readCount >= total) pace = 'done';
  else if (d < 0) pace = 'notStarted';
  else if (d >= plan.days) pace = 'ended';
  else if (readCount < due) pace = 'behind';
  else if (readCount > dueNow) pace = 'ahead';
  else pace = 'onTrack';
  return {
    d, today: todayKeys, todayDone: todayKeys.filter(has).length, total, read: readCount,
    due, diff: readCount - due, pace, overdue, daysLeft: Math.max(0, plan.days - Math.max(d, 0)),
  };
}

/**
 * New plan for what is still unread, starting today, spread over `days`.
 * `volume(k)` gives the verse count of a chapter key (falls back to 1).
 */
export function replan(plan: Plan, read: ReadonlySet<string>, days: number, today: string, volume: (k: string) => number): Plan {
  const left = plan.chapters.filter((k) => !read.has(k));
  if (left.length === 0) throw new RangeError('nothing left to read');
  const refs: ChapterRef[] = left.map((k) => ({ ...parseKey(k), verses: Math.max(1, volume(k)) }));
  return makePlan(refs, plan.scope, days, today);
}

/** Consecutive days with at least one chapter read, counting back from today (or yesterday if today has none yet). */
export function streak(dates: Iterable<string>, today: string): number {
  const set = new Set(dates);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Projected finish date from the average pace of the last `window` days. null when there is no pace to project. */
export function projectedFinish(readDates: Iterable<string>, remaining: number, today: string, window = 14): string | null {
  if (remaining <= 0) return today;
  let recent = 0;
  for (const d of readDates) {
    const ago = daysBetween(d, today);
    if (ago >= 0 && ago < window) recent++;
  }
  if (recent === 0) return null;
  return addDays(today, Math.ceil(remaining / (recent / window)));
}
