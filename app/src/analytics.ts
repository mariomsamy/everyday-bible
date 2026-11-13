// Anonymous usage statistics sent to this app's own backend (/api/e), plus optional third-party
// measurement pixels (Meta, TikTok, Snapchat, GA4) configured on the server (/api/config).
//
// Both are OFF until the person opts in, separately, after confirming they are an adult (or have a
// guardian's permission). Events never carry verse text, notes or the exact chapters read.
import { create } from 'zustand';
import { useLibrary } from './state/library';
import { useSettings } from './state/settings';
import { useUI } from './state/ui';
import { getItem, setItem, removeItem } from './storage';
import { runtimeConfig } from './runtimeConfig';

export type Consent = 'granted' | 'denied' | null;
export type Feature =
  | 'highlight' | 'note' | 'listen' | 'compare' | 'ask' | 'search' | 'xref' | 'copy' | 'share'
  | 'study_filter' | 'study_search' | 'study_sort' | 'reading_settings' | 'search_versions' | 'search_dictation' | 'ask_relate' | 'ask_search';

const KEY = 'ob:analytics';
const KEY_MKT = 'ob:marketing';
const KEY_ADULT = 'ob:adult';
const KEY_DID = 'ob:did';
const SCREENS: Record<string, string> = { '': 'reader', '/settings': 'settings', '/terms': 'terms', '/privacy': 'privacy', '/plan': 'plan', '/progress': 'progress' };
const READING_KEYS = ['theme', 'font', 'fontSize', 'lineHeight', 'margins', 'align', 'verseNumbers', 'textMode'] as const;

/** The backend is part of the same app, so statistics are always available. */
export const analyticsAvailable = () => true;

const read = (k: string): Consent => {
  const v = getItem(k);
  // A stored "granted" without the age confirmation is not valid consent (partial storage clear, edited storage).
  if (v === 'granted') return getItem(KEY_ADULT) === '1' ? 'granted' : 'denied';
  return v === 'denied' ? v : null;
};

/** Random identifier created on this device. Not derived from anything about the person. */
function deviceId(): string {
  let id = getItem(KEY_DID);
  if (!id || !/^[\w-]{16,64}$/.test(id)) {
    id = crypto.randomUUID();
    setItem(KEY_DID, id);
  }
  return id;
}

interface AnalyticsStore {
  /** First-party anonymous statistics. */
  consent: Consent;
  /** Third-party measurement pixels. */
  marketing: Consent;
  /** The person confirmed they are 18+ or have a guardian's permission. */
  adult: boolean;
  setAdult: (v: boolean) => void;
  setConsent: (granted: boolean) => void;
  setMarketing: (granted: boolean) => void;
}

export const useAnalytics = create<AnalyticsStore>((set, get) => ({
  consent: read(KEY),
  marketing: read(KEY_MKT),
  adult: getItem(KEY_ADULT) === '1',
  setAdult: (adult) => {
    if (adult) setItem(KEY_ADULT, '1');
    else {
      removeItem(KEY_ADULT);
      // Without the age confirmation nothing optional may stay on.
      get().setConsent(false);
      get().setMarketing(false);
    }
    set({ adult });
  },
  setConsent: (granted) => {
    const consent: Consent = granted && get().adult ? 'granted' : 'denied';
    setItem(KEY, consent);
    set({ consent });
  },
  setMarketing: (granted) => {
    const marketing: Consent = granted && get().adult ? 'granted' : 'denied';
    setItem(KEY_MKT, marketing);
    set({ marketing });
  },
}));

/** True until the person has answered the consent question once. */
export const consentPending = () => useAnalytics.getState().consent === null && useAnalytics.getState().marketing === null;

type Params = Record<string, string | number | boolean>;
interface Evt { n: string; p?: Params; t: number }

let queue: Evt[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  clearTimeout(timer);
  timer = undefined;
  if (!queue.length || useAnalytics.getState().consent !== 'granted') {
    queue = [];
    return;
  }
  const body = JSON.stringify({ did: deviceId(), events: queue.splice(0, 50) });
  const sent = navigator.sendBeacon?.('/api/e', new Blob([body], { type: 'application/json' }));
  if (!sent) void fetch('/api/e', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => undefined);
}

/** Records an event. Without consent, does nothing. */
export function track(name: string, params?: Params) {
  const { consent, marketing } = useAnalytics.getState();
  if (consent === 'granted') {
    queue.push({ n: name, p: params, t: Date.now() });
    timer ??= setTimeout(flush, 5000);
  }
  // Ad pixels never receive reading data: only a fixed, parameter-free event (see PIXEL_EVENTS).
  if (marketing === 'granted') pixelEvent(name);
}

export const trackFeature = (feature: Feature) => track('feature_use', { feature });

/** Asks the server to delete everything sent by this device, and starts over with a new identifier. */
export async function forgetMe(): Promise<boolean> {
  const did = deviceId();
  try {
    const r = await fetch('/api/forget', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ did }) });
    if (!r.ok) return false;
  } catch {
    return false;
  }
  queue = [];
  removeItem(KEY_DID);
  return true;
}

// ---- Third-party pixels (only after the separate marketing opt-in) ----

interface PixelConfig { meta?: string; tiktok?: string; snap?: string; ga4?: string }
type AnyFn = (...a: unknown[]) => void;
const w = window as unknown as Record<string, AnyFn & { queue?: unknown[]; callMethod?: AnyFn; push?: AnyFn; loaded?: boolean; _q?: unknown[] }> & { dataLayer?: unknown[] };

let pixels: Promise<PixelConfig> | null = null;
let pixelsLoaded: PixelConfig | null = null;

function script(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** The reading position lives in the path (and ?ref= in the query). Third-party pixels read the page address, so it is cleared first. */
function scrubAddress() {
  try {
    const root = new URL(import.meta.env.BASE_URL || '/', location.origin).pathname;
    if (location.pathname !== root || location.search) history.replaceState(history.state, '', root + location.hash);
  } catch {
    /* no history access: nothing to scrub */
  }
}

/** Events sent to ad pixels, with no parameters at all. Reading activity (chapters, versions, progress, plans) is never sent. */
const PIXEL_EVENTS = new Set(['app_install']);

async function loadPixels() {
  pixels ??= runtimeConfig().then((c) => c.pixels ?? {});
  const cfg = await pixels;
  if (pixelsLoaded || useAnalytics.getState().marketing !== 'granted') return;
  pixelsLoaded = cfg;
  scrubAddress(); // before any pixel can record the page address
  const id = (s?: string) => (s && /^[\w-]{4,40}$/.test(s) ? s : null);
  if (id(cfg.meta)) {
    const fbq = function (...a: unknown[]) { (fbq as unknown as { queue: unknown[] }).queue.push(a); } as unknown as AnyFn & { queue: unknown[]; loaded: boolean };
    fbq.queue = []; fbq.loaded = true;
    (fbq as unknown as Record<string, unknown>).push = fbq;
    (fbq as unknown as Record<string, unknown>).version = '2.0';
    w.fbq = fbq;
    (fbq as unknown as Record<string, unknown>).disablePushState = true; // no automatic page views on history changes
    script('https://connect.facebook.net/en_US/fbevents.js');
    w.fbq('set', 'autoConfig', false, cfg.meta);
    w.fbq('init', cfg.meta);
    w.fbq('track', 'PageView');
  }
  if (id(cfg.tiktok)) {
    // Same queue-until-loaded contract as TikTok's official snippet.
    const ttq = [] as unknown as Record<string, unknown> & unknown[];
    for (const m of ['page', 'track', 'identify', 'ready', 'on', 'off', 'once']) {
      ttq[m] = (...a: unknown[]) => { ttq.push([m, ...a]); };
    }
    ttq.load = (sdk: string) => {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${sdk}&lib=ttq`;
      document.head.appendChild(s);
    };
    (w as unknown as Record<string, unknown>).TiktokAnalyticsObject = 'ttq';
    (w as unknown as Record<string, unknown>).ttq = ttq;
    (ttq.load as (s: string) => void)(cfg.tiktok!);
    (ttq.page as () => void)();
  }
  if (id(cfg.snap)) {
    const sn = function (...a: unknown[]) { (sn as unknown as { queue: unknown[] }).queue.push(a); } as unknown as AnyFn & { queue: unknown[] };
    sn.queue = [];
    w.snaptr = sn;
    script('https://sc-static.net/scevent.min.js');
    w.snaptr('init', cfg.snap);
    w.snaptr('track', 'PAGE_VIEW');
  }
  if (id(cfg.ga4)) {
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = function () { (w.dataLayer as unknown[]).push(arguments); } as unknown as AnyFn;
    script(`https://www.googletagmanager.com/gtag/js?id=${cfg.ga4}`);
    w.gtag('js', new Date());
    // The reading position (book/chapter) is never sent to third parties: report only the site root.
    w.gtag('config', cfg.ga4, { send_page_view: true, page_location: location.origin + '/', page_path: '/', allow_google_signals: false, allow_ad_personalization_signals: false });
  }
}

function pixelEvent(name: string) {
  if (!PIXEL_EVENTS.has(name)) return;
  if (!pixelsLoaded) {
    void loadPixels().then(() => pixelsLoaded && useAnalytics.getState().marketing === 'granted' && pixelEvent(name));
    return;
  }
  const c = pixelsLoaded;
  const camel = name.replace(/(^|_)(\w)/g, (_, __, ch: string) => ch.toUpperCase());
  if (c.meta && w.fbq) w.fbq('trackCustom', camel, {});
  if (c.tiktok && w.ttq) (w.ttq as unknown as { track: AnyFn }).track(camel, {});
  if (c.snap && w.snaptr) w.snaptr('track', 'CUSTOM_EVENT_1', { description: name });
  if (c.ga4 && w.gtag) w.gtag('event', name, {});
}

/** Already-loaded third-party scripts cannot be unloaded: clear their cookies and reload so they are gone. */
function revokePixels() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (/^(_fbp|_fbc|_ga.*|_gid|_gat.*|_ttp|_tt_.*|ttcsid.*|_scid.*|sc_at)$/.test(name)) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname}`;
    }
  }
  location.reload();
}

let started = false;

/** Wires up the screen, version and install observers and applies the current choice. */
export function initAnalytics() {
  if (started) return;
  started = true;

  const screen = () => track('screen_view', { screen_name: SCREENS[location.hash.replace(/^#/, '')] ?? 'reader' });
  addEventListener('hashchange', screen);
  addEventListener('appinstalled', () => track('app_install'));
  addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  addEventListener('pagehide', flush);
  useSettings.subscribe((s, prev) => {
    if (s.versionId !== prev.versionId) track('version_use', { version: s.versionId });
    // Reading settings only: version and interface language have their own events or metrics.
    if (READING_KEYS.some((k) => s[k] !== prev[k])) trackFeature('reading_settings');
  });
  useUI.subscribe((s, prev) => {
    if (s.sheet === prev.sheet) return;
    if (s.sheet === 'compare' || s.sheet === 'search') trackFeature(s.sheet);
    else if (s.sheet === 'xrefs') trackFeature('xref');
    else if (s.sheet === 'library') track('screen_view', { screen_name: 'library' });
    else if (s.sheet === 'study') track('screen_view', { screen_name: 'study' });
  });
  useLibrary.subscribe((s, prev) => {
    if (!prev.ready) return;
    for (const id of Object.keys(s.installed)) if (!prev.installed[id]) track('version_download', { version: id });
  });
  let last = useAnalytics.getState().consent;
  let lastMkt = useAnalytics.getState().marketing;
  useAnalytics.subscribe((s) => {
    if (s.consent !== last) {
      last = s.consent;
      if (s.consent === 'granted') {
        track('version_use', { version: useSettings.getState().versionId });
        screen();
      } else queue = [];
    }
    if (s.marketing !== lastMkt) {
      lastMkt = s.marketing;
      if (s.marketing === 'granted') void loadPixels();
      else if (pixelsLoaded) revokePixels();
    }
  });
  if (last === 'granted') {
    track('version_use', { version: useSettings.getState().versionId });
    screen();
  }
  if (lastMkt === 'granted') void loadPixels();
}
