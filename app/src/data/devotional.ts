import type { UiLang } from '../state/settings';
import votd from './votd.json';

/** A verse or passage by reference only. The text comes from the version the person reads. */
export interface VerseRef {
  book: string;
  chapter: number;
  from: number;
  to?: number;
}

export interface Devotional {
  title: string;
  /** Always three paragraphs. */
  paragraphs: string[];
  today: string;
  prayer: string;
}

export interface DevotionalPack {
  version: number;
  lang: string;
  /** Texts for the dates that move every year. */
  moveable: Record<MoveableKey, Devotional>;
  /** "MM-DD" to text, February 29 included. */
  days: Record<string, Devotional>;
}

export type MoveableKey = 'goodFriday' | 'easter' | 'pentecost';

interface Votd {
  moveable: Record<MoveableKey, VerseRef>;
  days: Record<string, VerseRef>;
}

const list = votd as unknown as Votd;

/** Easter Sunday of the year in the Gregorian calendar (Meeus, Jones and Butcher). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export interface Today {
  /** The text key: "easter", or "MM-DD" on the other days. */
  key: MoveableKey | string;
  ref: VerseRef;
}

/** Which verse and text belong to the day. Good Friday, Easter and Pentecost replace the fixed one. */
export function todayFor(date: Date): Today {
  const easter = easterSunday(date.getFullYear());
  const here = dayKey(date);
  const moveable: [MoveableKey, Date][] = [['goodFriday', addDays(easter, -2)], ['easter', easter], ['pentecost', addDays(easter, 49)]];
  for (const [key, when] of moveable) if (dayKey(when) === here && when.getFullYear() === date.getFullYear()) return { key, ref: list.moveable[key] };
  return { key: here, ref: list.days[here] };
}

const KEYS = Object.keys(list.days);

/** Position of the date in the calendar, from 1 (January 1st) to 366 (December 31st), counting February 29th. It is the day ID of share links. */
export const dayId = (d: Date) => KEYS.indexOf(dayKey(d)) + 1;

/** The date of a day ID in the given year, or `null` for an ID out of range. February 29th falls on a leap year. */
export function dateOfDayId(id: number, year = new Date().getFullYear()): Date | null {
  const key = KEYS[id - 1];
  if (!key) return null;
  const [month, day] = key.split('-').map(Number);
  return new Date(key === '02-29' ? 2024 : year, month - 1, day);
}

/** Local date as YYYY-MM-DD, to remember on which day the devotional was shown. */
export const dateStamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Languages with their own pack. The others read the English one. */
const PACKS = ['pt-BR', 'en'] as const;
export type PackLang = (typeof PACKS)[number];
export const packLang = (ui: UiLang): PackLang => ((PACKS as readonly string[]).includes(ui) ? (ui as PackLang) : 'en');

/** Bytes of each pack once decoded, only to draw the progress bar when the server does not say how big it is. */
const ESTIMATE = 360_000;

/** Downloads the pack of a language. The caller keeps it on the device, like the Bible versions. */
export async function downloadPack(lang: PackLang, onProgress: (fraction: number) => void): Promise<DevotionalPack> {
  const res = await fetch(`${import.meta.env.BASE_URL}devotional/${lang}.json`);
  if (!res.ok || !res.body) throw new Error(`devotional ${lang}: ${res.status}`);
  // With compression the header counts the compressed bytes, so it only serves when the body arrives as it is.
  const sent = Number(res.headers.get('content-length')) || 0;
  const total = res.headers.get('content-encoding') ? ESTIMATE : sent || ESTIMATE;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(Math.min(received / total, 0.99));
  }
  const text = new TextDecoder().decode(await new Blob(chunks as BlobPart[]).arrayBuffer());
  return JSON.parse(text) as DevotionalPack;
}
