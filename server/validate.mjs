// Strict validation of what the browser may send. Anything unexpected is dropped, never stored.
export const DID_RE = /^[\w-]{16,64}$/;
const MAX_EVENTS = 50;

// Allowlist: event name -> allowed prop keys. Anything else is dropped, so free text (verse text, notes) cannot be stored.
export const SCHEMA = {
  screen_view: ['screen_name'], version_use: ['version'], version_download: ['version'], feature_use: ['feature'],
  app_install: [], chapter_read: ['book'], plan_created: ['days', 'scope'],
  progress: ['read', 'pct', 'streak', 'plan_days', 'pace'], share: ['channel', 'kind'],
  link_open: ['kind'], intro_step: ['step'], intro_done: [],
};
const VALUE_RE = /^[\w.-]{1,32}$/; // short identifiers only: no spaces, so no sentences

/** @returns {Record<string, string|number|boolean>} */
export function cleanProps(raw, allowed) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const k of allowed) {
    const v = Object.hasOwn(raw, k) ? raw[k] : undefined;
    if (typeof v === 'string' && VALUE_RE.test(v)) out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/** @returns {{did: string, events: {name: string, props: object, ts: number}[]} | null} */
export function parseEvents(body, now = Date.now()) {
  if (!body || typeof body !== 'object' || typeof body.did !== 'string' || !DID_RE.test(body.did) || !Array.isArray(body.events)) return null;
  const events = [];
  for (const e of body.events.slice(0, MAX_EVENTS)) {
    if (!e || typeof e.n !== 'string' || !Object.hasOwn(SCHEMA, e.n)) continue;
    // Never trust the client clock for ordering: clamp to [now - 1 day, now].
    const t = Number.isFinite(e.t) ? Math.min(now, Math.max(now - 86_400_000, e.t)) : now;
    events.push({ name: e.n, props: cleanProps(e.p, SCHEMA[e.n]), ts: t });
  }
  return { did: body.did, events };
}

/** Pixel IDs from the environment: only safe characters, so they can be placed into scripts and the CSP. */
export function pixelConfig(env) {
  const ok = (v) => (typeof v === 'string' && /^[\w-]{4,40}$/.test(v) ? v : undefined);
  const cfg = { meta: ok(env.META_PIXEL_ID), tiktok: ok(env.TIKTOK_PIXEL_ID), snap: ok(env.SNAP_PIXEL_ID), ga4: ok(env.GA4_ID) };
  return Object.fromEntries(Object.entries(cfg).filter(([, v]) => v));
}

export function contentSecurityPolicy(pixels, { cdn = true } = {}) {
  const script = ["'self'"];
  // Bible texts are downloaded once from the project's public data repo, through jsDelivr (or GitHub raw as a fallback).
  // Texts are served by this server. The public CDNs are only a fallback and can be switched off (CDN_FALLBACK=0).
  const connect = ["'self'", ...(cdn ? ['https://cdn.jsdelivr.net', 'https://raw.githubusercontent.com'] : [])];
  const img = ["'self'", 'data:', 'blob:'];
  if (pixels.meta) { script.push('https://connect.facebook.net'); connect.push('https://www.facebook.com', 'https://connect.facebook.net'); img.push('https://www.facebook.com'); }
  if (pixels.tiktok) { script.push('https://analytics.tiktok.com'); connect.push('https://analytics.tiktok.com'); img.push('https://analytics.tiktok.com'); }
  if (pixels.snap) { script.push('https://sc-static.net'); connect.push('https://tr.snapchat.com', 'https://sc-static.net'); img.push('https://tr.snapchat.com'); }
  if (pixels.ga4) { script.push('https://www.googletagmanager.com'); connect.push('https://www.google-analytics.com', 'https://region1.google-analytics.com', 'https://www.googletagmanager.com'); img.push('https://www.google-analytics.com', 'https://www.googletagmanager.com'); }
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img.join(' ')}`,
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
