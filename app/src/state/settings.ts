import { create } from 'zustand';
import { suggestedVersion } from '../data/catalog';
import { getItem, getJson, setItem, setJson } from '../storage';

export type Theme = 'auto' | 'light' | 'sepia' | 'dark';
export type FontFamily = 'serif' | 'sans' | 'mono';
export type Margins = 'narrow' | 'medium' | 'wide';
export type Align = 'left' | 'justify';
export type VerseNumbers = 'visible' | 'subtle' | 'hidden';
export type TextMode = 'verses' | 'paragraph';
export type UiLang = 'ar' | 'en';

export interface Settings {
  uiLang: UiLang;
  versionId: string;
  theme: Theme;
  font: FontFamily;
  fontSize: number;
  lineHeight: number;
  margins: Margins;
  align: Align;
  verseNumbers: VerseNumbers;
  textMode: TextMode;
  /** Opens the verse of the day and the devotional by itself, once a day. */
  devotional: boolean;
}

const SUPPORTED: UiLang[] = ['ar', 'en'];

/** UI language from the browser preferences. Falls back to Arabic when nothing matches. */
export function detectUiLang(langs: readonly string[] = navigator.languages?.length ? navigator.languages : [navigator.language]): UiLang {
  for (const l of langs) {
    const base = l.toLowerCase().split('-')[0];
    const hit = SUPPORTED.find((s) => s.toLowerCase().split('-')[0] === base);
    if (hit) return hit;
  }
  return 'ar';
}

// The app is Arabic-first: it opens in Arabic and switches only when the person chooses another language.
const initialLang: UiLang = 'ar';

export const DEFAULTS: Settings = {
  uiLang: initialLang,
  versionId: suggestedVersion(initialLang),
  theme: 'auto',
  font: 'serif',
  fontSize: 19,
  lineHeight: 1.7,
  margins: 'medium',
  align: 'left',
  verseNumbers: 'subtle',
  textMode: 'verses',
  devotional: false,
};

const KEY = 'ob:settings';

// One-time: before the app was Arabic-first, English was saved automatically for English browsers (not chosen by the person).
// Moves those devices to Arabic once; the language switch (menu, settings, first screen) still changes it for good.
const LANG_FLAG = 'ob:lang-ar-default';

const load = (): Settings => {
  const saved = getJson<Partial<Settings>>(KEY, {});
  if (!getItem(LANG_FLAG)) {
    setItem(LANG_FLAG, '1');
    if (saved.uiLang === 'en') saved.uiLang = 'ar';
  }
  return { ...DEFAULTS, ...saved };
};

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  /** Resets only the reading settings. UI language, version and the daily devotional stay as they are. */
  resetText: () => void;
}

export const useSettings = create<SettingsStore>((set) => ({
  ...load(),
  set: (key, value) => set({ [key]: value } as Partial<Settings>),
  resetText: () => set(({ uiLang, versionId, devotional }) => ({ ...DEFAULTS, uiLang, versionId, devotional })),
}));

const dark = matchMedia('(prefers-color-scheme: dark)');
const THEME_COLORS = { light: '#faf9f7', sepia: '#f3ead8', dark: '#14161b' } as const;

export function applyTheme(theme: Theme) {
  const resolved = theme === 'auto' ? (dark.matches ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
}

export function applyLang(lang: UiLang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export function initSettingsEffects() {
  applyTheme(useSettings.getState().theme);
  applyLang(useSettings.getState().uiLang);
  dark.addEventListener('change', () => applyTheme(useSettings.getState().theme));
  useSettings.subscribe((s) => {
    applyTheme(s.theme);
    applyLang(s.uiLang);
    const { set: _s, resetText: _r, ...data } = s;
    setJson(KEY, data);
  });
}
