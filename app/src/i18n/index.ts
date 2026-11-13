import { useMemo } from 'react';
import { useSettings, type UiLang } from '../state/settings';
import en, { type Messages } from './locales/en';
import ar from './locales/ar';

export type Key = keyof Messages;
type Params = Record<string, string | number>;
/** Keys that have `_one` and `_other` forms. */
export type PluralKey = { [K in Key]: K extends `${infer B}_one` ? B : never }[Key];

export const LOCALES: Record<UiLang, Messages> = { en, ar };

const fill = (s: string, p?: Params) => (p ? s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? `{${k}}`)) : s);

export function translate(lang: UiLang, key: Key, params?: Params): string {
  return fill(LOCALES[lang][key] ?? en[key], params);
}

export function translatePlural(lang: UiLang, key: PluralKey, n: number, params?: Params): string {
  const cat = new Intl.PluralRules(lang).select(n);
  const table = LOCALES[lang];
  const k = (`${key}_${cat}` in table ? `${key}_${cat}` : `${key}_other`) as Key;
  return fill(table[k] ?? en[`${key}_other` as Key], { n, ...params });
}

export interface Translator {
  (key: Key, params?: Params): string;
  /** Text with number agreement: `t.n('verse', 3)`. */
  n: (key: PluralKey, n: number, params?: Params) => string;
  /** Size in megabytes, with the language's decimal separator and unit. */
  mb: (n: number) => string;
  lang: UiLang;
}

export function makeTranslator(lang: UiLang): Translator {
  const t = ((key: Key, params?: Params) => translate(lang, key, params)) as Translator;
  t.n = (key, n, params) => translatePlural(lang, key, n, params);
  t.mb = (n) => translate(lang, 'sizeMb', { n: new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n) });
  t.lang = lang;
  return t;
}

/** Translator for components: re-renders when the UI language changes. */
export function useT(): Translator {
  const lang = useSettings((s) => s.uiLang);
  return useMemo(() => makeTranslator(lang), [lang]);
}

/** Translator for code outside components (toasts, for example). Reads the current language on every call. */
export const tr = (key: Key, params?: Params) => translate(useSettings.getState().uiLang, key, params);

/** Splits translated text on `{icon}` to insert an icon in the middle of the sentence. */
export function splitIcon(text: string): [string, string] {
  const i = text.indexOf('{icon}');
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 6)];
}
