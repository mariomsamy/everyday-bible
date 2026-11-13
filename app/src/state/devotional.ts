import { create } from 'zustand';
import { getItem, setItem } from '../storage';
import { dbGet, dbPut } from '../db';
import { dateStamp, downloadPack, packLang, type DevotionalPack, type PackLang } from '../data/devotional';
import { useSettings } from './settings';
import { track } from '../analytics';

/** "1" once the person answered the invitation to turn the daily devotional on, in the onboarding or in the sheet. */
const ASKED = 'ob:devotionalAsked';
/** The day (YYYY-MM-DD) the devotional last opened by itself, so it shows once a day. */
const SHOWN = 'ob:devotionalShown';

/** The progress bar stays at least this long, so it does not flash when the pack is already close. */
const MIN_LOADING = 300;

export type OpenSource = 'auto' | 'menu' | 'link';
export type EnableSource = 'settings' | 'intro' | 'invite';

interface DevotionalStore {
  /** `idle` while the device is checked, `loading` only while the pack is downloaded. */
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error';
  /** Download progress, from 0 to 1. */
  progress: number;
  pack: DevotionalPack | null;
  asked: boolean;
  /** Day ID (1-366) a share link asked for, until the sheet closes. `null` is today. */
  day: number | null;
  /** What opened the sheet, for the usage statistics: the first open of the day, a share link or the menu. */
  source: OpenSource;
  /** Opens the pack of the interface language (English when the language has none) from the device, downloading it only the first time. */
  load: () => Promise<void>;
  markAsked: () => void;
  /** Turns the daily devotional on, from where the person chose it. It was just shown or chosen, so it waits for tomorrow to open by itself. */
  enable: (source: EnableSource) => void;
}

let current = 0;

/** Quietly checks for a newer pack. It only replaces the copy on the device, with no bar. */
async function refresh(lang: PackLang, stored: DevotionalPack, id: number) {
  if (navigator.onLine === false) return;
  try {
    const pack = await downloadPack(lang, () => undefined);
    if (pack.version <= stored.version) return;
    await dbPut('devotional', [pack], [lang]);
    if (id === current) useDevotional.setState({ pack });
  } catch {
    /* the copy on the device keeps working */
  }
}

export const useDevotional = create<DevotionalStore>((set, get) => ({
  status: 'idle',
  progress: 0,
  pack: null,
  asked: getItem(ASKED) === '1',
  day: null,
  source: 'menu',
  load: async () => {
    const lang = packLang(useSettings.getState().uiLang);
    if (get().pack?.lang === lang) return set({ status: 'ready' });
    const id = ++current;
    // The bar belongs to the download only: while the device is checked, nothing is drawn.
    set({ status: 'idle', progress: 0, pack: null });
    const stored = await dbGet<DevotionalPack>('devotional', lang).catch(() => undefined);
    if (id !== current) return;
    if (stored) {
      set({ pack: stored, status: 'ready' });
      void refresh(lang, stored, id);
      return;
    }
    const started = Date.now();
    set({ status: 'loading' });
    try {
      const pack = await downloadPack(lang, (progress) => id === current && set({ progress }));
      await dbPut('devotional', [pack], [lang]).catch(() => undefined);
      const wait = MIN_LOADING - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      if (id === current) set({ pack, status: 'ready', progress: 1 });
    } catch {
      if (id === current) {
        const reason = navigator.onLine === false ? 'offline' : 'error';
        track('devotional_error', { reason });
        set({ status: reason });
      }
    }
  },
  markAsked: () => {
    setItem(ASKED, '1');
    set({ asked: true });
  },
  enable: (source) => {
    track('devotional_enable', { source });
    useSettings.getState().set('devotional', true);
    get().markAsked();
    markShownToday();
    // Fetch the texts now, in the background, so tomorrow's devotional opens at once, even offline.
    void get().load();
  },
}));

export const shownToday = () => getItem(SHOWN) === dateStamp(new Date());
export const markShownToday = () => setItem(SHOWN, dateStamp(new Date()));
