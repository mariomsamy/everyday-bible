// Admin-editable settings, stored in SQLite. Only keys listed in FIELDS can be stored; every value is validated.
// Secrets (the AI API key) are encrypted at rest with a key derived from ADMIN_TOKEN and are never returned to any client.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ID = (v) => (typeof v === 'string' && (v === '' || /^[\w-]{4,40}$/.test(v)) ? v : undefined);
const BOOL = (v) => (typeof v === 'boolean' ? v : undefined);
const INT = (min, max) => (v) => (Number.isInteger(v) && v >= min && v <= max ? v : undefined);
const ENUM = (...xs) => (v) => (xs.includes(v) ? v : undefined);
const TEXT = (max) => (v) => (typeof v === 'string' && v.length <= max && !v.includes('\0') ? v.trim() : undefined);
const MODEL = (v) => (typeof v === 'string' && (v === '' || /^[\w.:/@-]{1,100}$/.test(v)) ? v : undefined);

/** https only, no IP literals, no localhost/internal names: the base URL of a custom (OpenAI-compatible) vendor. */
export function safeBaseUrl(v) {
  if (v === '') return '';
  if (typeof v !== 'string' || v.length > 200) return undefined;
  let u;
  try { u = new URL(v); } catch { return undefined; }
  const h = u.hostname.toLowerCase().replace(/\.+$/, ''); // 'localhost.' and 'x.internal.' are the same names
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) return undefined;
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /\.(local|internal|localhost|lan)$/.test(h) || h === 'localhost') return undefined;
  return u.origin + u.pathname.replace(/\/+$/, '');
}

export const VENDOR_IDS = ['anthropic', 'openai', 'gemini', 'openrouter', 'custom'];

export const FIELDS = {
  // Tracking pixels (empty = fall back to the environment variable)
  meta_pixel_id: { v: ID, def: '' }, tiktok_pixel_id: { v: ID, def: '' }, snap_pixel_id: { v: ID, def: '' }, ga4_id: { v: ID, def: '' },
  // Analytics
  events_enabled: { v: BOOL, def: true },
  retention_days: { v: INT(30, 400), def: 400 },
  // AI assistant
  ai_enabled: { v: BOOL, def: false },
  ai_vendor: { v: ENUM(...VENDOR_IDS), def: 'anthropic' },
  ai_model: { v: MODEL, def: '' },
  ai_base_url: { v: safeBaseUrl, def: '' },
  ai_api_key: { secret: true, v: (v) => (typeof v === 'string' && /^[\w.~+/=-]{8,400}$/.test(v) ? v : undefined), def: '' },
  events_daily_budget: { v: INT(1000, 50_000_000), def: 500_000 },
  events_per_device_day: { v: INT(10, 100_000), def: 1000 },
  ai_per_minute: { v: INT(1, 30), def: 6 },
  ai_daily_per_ip: { v: INT(1, 500), def: 30 },
  ai_daily_global: { v: INT(1, 1_000_000), def: 500 },
  ai_max_tokens: { v: INT(64, 4000), def: 700 },
  ai_system_prompt: { v: TEXT(2000), def: '' },
};

const keyFor = (secret) => createHash('sha256').update(`bible-settings:${secret}`).digest();
export function encrypt(plain, secret) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}
export function decrypt(blob, secret) {
  try {
    const [v, iv, tag, data] = String(blob).split(':');
    if (v !== 'v1') return '';
    const d = createDecipheriv('aes-256-gcm', keyFor(secret), Buffer.from(iv, 'base64'), { authTagLength: 16 });
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
  } catch { return ''; } // wrong token or corrupted: treat as not set
}

/** Raw stored values merged over the defaults. The API key is decrypted here: never send this object to a client. */
export function loadSettings(db, secret) {
  const out = Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.def]));
  for (const r of db.prepare('SELECT key, value FROM settings').all()) {
    const f = FIELDS[r.key];
    if (!f) continue;
    if (f.secret) { out[r.key] = decrypt(r.value, secret); continue; }
    try { const v = f.v(JSON.parse(r.value)); if (v !== undefined) out[r.key] = v; } catch { /* keep default */ }
  }
  return out;
}

/** @returns {{ok: boolean, errors: Record<string,string>}} Applies a partial update atomically. `null` or '' resets a key. */
export function saveSettings(db, patch, secret, now = Date.now()) {
  const errors = {};
  const writes = [];
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { ok: false, errors: { _: 'invalid body' } };
  for (const [k, raw] of Object.entries(patch)) {
    const f = Object.hasOwn(FIELDS, k) ? FIELDS[k] : null;
    if (!f) { errors[k] = 'unknown setting'; continue; }
    if (raw === null || (raw === '' && f.def === '')) { writes.push([k, null]); continue; }
    const v = f.v(raw);
    if (v === undefined) { errors[k] = 'invalid value'; continue; }
    writes.push([k, f.secret ? encrypt(v, secret) : JSON.stringify(v)]);
  }
  // The saved API key is bound to the vendor it was entered for: changing the vendor or base URL needs the key again,
  // otherwise a changed destination would receive the old key.
  const cur = loadSettings(db, secret);
  if (cur.ai_api_key && !Object.hasOwn(patch, 'ai_api_key')) {
    for (const k of ['ai_vendor', 'ai_base_url']) {
      if (!Object.hasOwn(patch, k)) continue;
      const f = FIELDS[k];
      const next = patch[k] === null || patch[k] === '' ? f.def : f.v(patch[k]);
      if (next !== undefined && next !== cur[k]) errors.ai_api_key = 're-enter the API key when changing the vendor or base URL';
    }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  db.exec('BEGIN');
  try {
    for (const [k, val] of writes) {
      if (val === null) db.prepare('DELETE FROM settings WHERE key = ?').run(k);
      else db.prepare('INSERT INTO settings (key, value, updated) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = excluded.updated').run(k, val, now);
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { ok: true, errors: {} };
}

/** What the admin page may see: everything except secret values. */
export function publicView(s, env) {
  const view = {};
  for (const [k, f] of Object.entries(FIELDS)) if (!f.secret) view[k] = s[k];
  const key = s.ai_api_key;
  return {
    values: view,
    secrets: { ai_api_key: { set: !!key, hint: key ? `…${key.slice(-4)}` : '' } },
    env: { meta: !!env.META_PIXEL_ID, tiktok: !!env.TIKTOK_PIXEL_ID, snap: !!env.SNAP_PIXEL_ID, ga4: !!env.GA4_ID },
  };
}

/** Pixel ids: the admin setting wins over the environment variable. */
export function effectivePixelEnv(s, env) {
  return {
    META_PIXEL_ID: s.meta_pixel_id || env.META_PIXEL_ID,
    TIKTOK_PIXEL_ID: s.tiktok_pixel_id || env.TIKTOK_PIXEL_ID,
    SNAP_PIXEL_ID: s.snap_pixel_id || env.SNAP_PIXEL_ID,
    GA4_ID: s.ga4_id || env.GA4_ID,
  };
}
