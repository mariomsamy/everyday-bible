import type { UiLang } from '../state/settings';

/** Latin digits in both languages, so numbers match what is printed on shared images. */
export const localeOf = (lang: UiLang) => (lang === 'ar' ? 'ar-u-nu-latn' : 'en');

export function fmtDate(date: string, lang: UiLang): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(localeOf(lang), { dateStyle: 'medium' }).format(new Date(y, m - 1, d));
}

export const fmtNum = (n: number, lang: UiLang, digits = 0) =>
  new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: digits }).format(n);

/** Rough reading time: seconds per verse, aloud-ish pace. */
export const minutesFor = (verses: number) => Math.max(1, Math.round((verses * 7) / 60));
