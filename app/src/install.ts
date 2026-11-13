import { getItem, removeItem, setItem } from './storage';
import { useUI } from './state/ui';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const flag = (key: string) => !!getItem(key);
const setFlag = (key: string) => setItem(key, '1');
const clearFlag = removeItem;

const INSTALLED = 'ob:installed';
const DISMISSED = 'ob:install-dismissed';

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  // The browser only offers installation when the app is not installed: if the mark is left over, it was uninstalled.
  clearFlag(INSTALLED);
  emit();
});

addEventListener('appinstalled', () => {
  deferred = null;
  setFlag(INSTALLED);
  emit();
});

/** For `useSyncExternalStore`: notifies when the native prompt becomes available or stops being available. */
export function subscribeInstall(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** The browser released the native install prompt (Android, Chrome and Edge on desktop). */
export const canPromptInstall = () => deferred !== null;

/** Triggers the native prompt (Android/Chrome). Returns false if there is none, and then we show the manual guide. */
export async function requestInstall(): Promise<boolean> {
  if (!deferred) return false;
  const ev = deferred;
  deferred = null;
  emit();
  // The browser may take the current URL as the start page: during installation it points to the root.
  useUI.getState().setHomeUrl(true);
  history.replaceState(history.state, '', import.meta.env.BASE_URL);
  try {
    await ev.prompt();
  } finally {
    useUI.getState().setHomeUrl(false);
  }
  return true;
}

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export interface IosInfo {
  device: 'iPhone' | 'iPad';
  browser: 'safari' | 'chrome' | 'other';
}

/** iPhone or iPad and the browser, via user agent. On iPadOS Safari presents itself as a Mac, so touch is also counted. */
export function detectIOS(ua: string = navigator.userAgent, touchPoints: number = navigator.maxTouchPoints): IosInfo | null {
  const phone = /iPhone|iPod/.test(ua);
  const pad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  if (!phone && !pad) return null;
  const browser = /CriOS/.test(ua) ? 'chrome' : /FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\//.test(ua) ? 'other' : /Safari\//.test(ua) ? 'safari' : 'other';
  return { device: phone ? 'iPhone' : 'iPad', browser };
}

export const isIOS = () => detectIOS() !== null;

/** Phone or tablet: touch is the primary pointer. On desktop there is no gesture hint or install invitation. */
export const isMobile = () => matchMedia('(pointer: coarse)').matches || isIOS() || /Android/i.test(navigator.userAgent);

let dismissedNow = false;

/** The app is already installed: opened as an app (standalone) or installed by this browser. On iOS only the first case is detectable. */
export const isInstalled = () => isStandalone() || flag(INSTALLED);

/** Any install entry point (menu item, row in Settings) is worth showing: mobile device and not yet installed. */
export const installAvailable = () => isMobile() && !isInstalled();

/** The install invitation (banner) should show: not installed and not yet dismissed nor the guide opened. */
export const installOffered = () => installAvailable() && !dismissedNow && !flag(DISMISSED);

/** Hides the banner for good, by dismissal or because the install guide was already opened. */
export function dismissInstall() {
  dismissedNow = true;
  setFlag(DISMISSED);
  emit();
}
