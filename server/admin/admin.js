'use strict';
const $ = (s) => document.querySelector(s);
const app = $('#app');
const nf = new Intl.NumberFormat('en');
const n = (v, d = 0) => nf.format(Number(Number(v).toFixed(d)));

// Build DOM with textContent only (no innerHTML), so no value from the database can inject markup.
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v);
  for (const k of kids) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
const card = (title, ...kids) => el('div', { class: 'card' }, el('h2', {}, title), ...kids);
const stat = (title, big, sub) => card(title, el('div', { class: 'big' }, big), el('div', { class: 'sub' }, sub || ''));
function table(rows, empty = 'No data yet') {
  if (!rows.length) return el('div', { class: 'sub' }, empty);
  return el('table', {}, ...rows.map(([a, b]) => el('tr', {}, el('td', {}, a), el('td', {}, b))));
}
function hbars(rows) {
  if (!rows.length) return el('div', { class: 'sub' }, 'No data yet');
  const max = Math.max(1, ...rows.map((r) => r.n));
  return el('div', {}, ...rows.map((r) => el('div', { class: 'hbar' }, el('b', { title: r.k }, r.k), el('span', {}, el('i', { style: `width:${(r.n / max) * 100}%` })), el('em', {}, n(r.n)))));
}
function bars(series, key, label) {
  const max = Math.max(1, ...series.map((r) => r[key]));
  return el('div', { class: 'bars', role: 'img', 'aria-label': label }, ...series.map((r) => el('i', { title: `${r.day}: ${r[key]}`, style: `height:${(r[key] / max) * 100}%` })));
}
function fill30(series, key) {
  const map = new Map(series.map((r) => [r.day, r]));
  const out = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); out.push({ day: d, [key]: map.get(d)?.[key] ?? 0 }); }
  return out;
}

function renderAnalytics(s) {
  $('#gen').textContent = `Updated ${s.generatedAt}`;
  const p = s.progress;
  const hist = p.histogram.map((c, i) => ({ k: `${i * 10}–${i === 9 ? 100 : i * 10 + 9}%`, n: c }));
  return [
    el('div', { class: 'grid' },
      stat('Users (devices that opted in)', n(s.users.total), `${n(s.users.newLast30)} new in 30 days`),
      stat('Active today', n(s.users.active1), `${n(s.users.active7)} in 7 days · ${n(s.users.active30)} in 30 days`),
      stat('Avg progress', `${n(p.avgPct, 1)}%`, `${n(p.avgChapters, 1)} chapters on average`),
      stat('Streaks', `${n(p.avgStreak, 1)} avg`, `longest ${n(p.maxStreak)} days`),
      stat('Installs (PWA)', n(s.installs), 'all time'),
      stat('With a reading plan', n(p.withPlan), s.users.total ? `${n((p.withPlan / s.users.total) * 100)}% of users` : '')),
    el('div', { class: 'grid' },
      card('Daily active users (30 days)', bars(fill30(s.dau, 'users'), 'users', 'DAU')),
      card('Chapters finished per day', bars(fill30(s.chaptersPerDay, 'n'), 'n', 'Chapters per day'))),
    el('div', { class: 'grid' },
      card('Progress distribution', hbars(hist)),
      card('Plan pace', hbars(p.pace.map((r) => ({ k: r.k, n: r.n })))),
      card('Plan length (days)', hbars(p.planDays.map((r) => ({ k: r.k, n: r.n }))))),
    el('div', { class: 'grid' },
      card('Most read books (30 days)', hbars(s.topBooks)),
      card('Shares by channel', hbars(s.shares)),
      card('Bible versions in use', hbars(s.versions))),
    el('div', { class: 'grid' },
      card('Screens', hbars(s.screens)),
      card('Features used', hbars(s.features)),
      card('All events (30 days)', table(s.events.map((e) => [e.name, `${n(e.n)} · ${n(e.users)} users`])))),
    card('Tracking pixels configured on the server',
      ...Object.entries(s.pixels).map(([k, on]) => el('span', { class: `pill ${on ? 'on' : 'off'}` }, `${k}: ${on ? 'on' : 'not set'}`)),
      el('p', { class: 'sub' }, 'Pixels load in a visitor’s browser only after they opt in to advertising pixels. Edit them in the Pixels tab.')),
  ];
}


// ---------------- API + tabs ----------------
// The admin token lives in memory only (never in storage): reloading the page asks for it again.
let token = '';
let tab = 'analytics';
const api = async (path, method = 'GET', body) => {
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (r.status === 401) throw new Error('Wrong token');
  if (r.status === 503) throw new Error('Dashboard disabled: set ADMIN_TOKEN (16+ characters) on the server');
  if (r.status === 429) throw new Error('Too many attempts, wait a few minutes');
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.fields ? Object.entries(j.fields).map(([k, v]) => `${k}: ${v}`).join(', ') : j.error || `Error ${r.status}`), { body: j });
  return j;
};

const TABS = [['analytics', 'Analytics'], ['pixels', 'Pixels'], ['ai', 'AI assistant'], ['data', 'Data & privacy']];
function nav() {
  return el('nav', { class: 'tabs', role: 'tablist' }, ...TABS.map(([id, label]) => {
    const b = el('button', { role: 'tab', 'aria-selected': String(id === tab), class: id === tab ? 'on' : '' }, label);
    b.addEventListener('click', () => { tab = id; show(); });
    return b;
  }));
}

// --- form helpers (DOM built with textContent only) ---
const field = (label, input, hint) => el('label', { class: 'fld' }, el('span', {}, label), input, hint ? el('small', {}, hint) : '');
const text = (name, value, o = {}) => { const i = el('input', { name, type: o.type || 'text', autocomplete: 'off', spellcheck: 'false', placeholder: o.placeholder || '' }); i.value = value ?? ''; return i; };
const num = (name, value, min, max) => { const i = el('input', { name, type: 'number', min, max, step: 1 }); i.value = value; return i; };
const check = (name, value, label) => { const i = el('input', { name, type: 'checkbox' }); i.checked = !!value; return el('label', { class: 'chk' }, i, label); };
const select = (name, value, options) => { const s = el('select', { name }, ...options.map(([v, l]) => el('option', { value: v }, l))); s.value = value; return s; };
const notice = (kind, msg) => el('p', { class: `note ${kind}`, role: kind === 'bad' ? 'alert' : 'status' }, msg);

/** Reads a form into a patch: only fields that changed; numbers and checkboxes typed; empty secrets are skipped. */
function readPatch(form, cur) {
  const patch = {};
  for (const e of form.elements) {
    if (!e.name) continue;
    let v = e.type === 'checkbox' ? e.checked : e.type === 'number' ? Number(e.value) : e.value.trim();
    if (e.dataset.secret) { if (v) patch[e.name] = v; continue; }
    if (cur[e.name] !== v) patch[e.name] = v;
  }
  return patch;
}
async function submit(form, cur, out, after) {
  out.replaceChildren();
  const patch = readPatch(form, cur);
  if (!Object.keys(patch).length) return out.append(notice('', 'Nothing changed.'));
  try { const next = await api('/api/admin/settings', 'PUT', patch); flash = 'Saved. Changes are live now.'; after(next); } catch (e) { out.append(notice('bad', e.message)); }
}

// --- Pixels ---
function pixelsTab(st) {
  const v = st.values;
  const out = el('div');
  const f = el('form', { class: 'form' },
    el('p', { class: 'sub' }, 'IDs set here override the server environment variables. Leave empty to use the environment value (or no pixel). Pixels run in a visitor’s browser only after they opt in to advertising pixels.'),
    field(`Meta (Facebook) Pixel ID${st.env.meta ? ' — also set in env' : ''}`, text('meta_pixel_id', v.meta_pixel_id, { placeholder: st.env.meta ? 'using environment value' : 'e.g. 1234567890' })),
    field(`TikTok Pixel ID${st.env.tiktok ? ' — also set in env' : ''}`, text('tiktok_pixel_id', v.tiktok_pixel_id, { placeholder: st.env.tiktok ? 'using environment value' : 'e.g. C1ABCDEF' })),
    field(`Snapchat Pixel ID${st.env.snap ? ' — also set in env' : ''}`, text('snap_pixel_id', v.snap_pixel_id, { placeholder: st.env.snap ? 'using environment value' : 'UUID' })),
    field(`Google Analytics 4 ID${st.env.ga4 ? ' — also set in env' : ''}`, text('ga4_id', v.ga4_id, { placeholder: st.env.ga4 ? 'using environment value' : 'G-XXXXXXXXXX' })),
    el('button', { type: 'submit' }, 'Save pixels'), out);
  f.addEventListener('submit', (e) => { e.preventDefault(); submit(f, v, out, (n) => { settings = n; show(); }); });
  return [card('Tracking pixels', f)];
}

// --- AI ---
function aiTab(st) {
  const v = st.values;
  const out = el('div');
  const vendorSel = select('ai_vendor', v.ai_vendor, Object.entries(st.ai.vendors).map(([k, x]) => [k, x.label]));
  const base = field('Base URL (https, OpenAI-compatible; ends before /chat/completions)', text('ai_base_url', v.ai_base_url, { placeholder: 'https://api.example.com/v1' }));
  const modelIn = text('ai_model', v.ai_model);
  const sync = () => { base.hidden = vendorSel.value !== 'custom'; modelIn.placeholder = st.ai.vendors[vendorSel.value]?.model ? `default: ${st.ai.vendors[vendorSel.value].model}` : 'model id (required)'; };
  vendorSel.addEventListener('change', sync);
  const keyIn = text('ai_api_key', '', { type: 'password', placeholder: st.secrets.ai_api_key.set ? `saved (${st.secrets.ai_api_key.hint}) — type to replace` : 'paste the API key' });
  keyIn.dataset.secret = '1';
  const clearKey = el('button', { type: 'button', class: 'ghost' }, 'Remove saved key');
  clearKey.hidden = !st.secrets.ai_api_key.set;
  clearKey.addEventListener('click', async () => { if (!confirm('Remove the saved API key? The assistant will stop working.')) return; try { settings = await api('/api/admin/settings', 'PUT', { ai_api_key: null }); show(); } catch (e) { out.replaceChildren(notice('bad', e.message)); } });
  const test = el('button', { type: 'button', class: 'ghost' }, 'Test connection');
  const testOut = el('div');
  test.addEventListener('click', async () => {
    testOut.replaceChildren(notice('', 'Testing (sends one tiny request, a few tokens)…'));
    try { const r = await api('/api/admin/ai/test', 'POST'); testOut.replaceChildren(r.ok ? notice('ok', `Works. ${r.ms} ms${r.sample ? ` · reply: “${r.sample}”` : ''}`) : notice('bad', `Failed: ${r.error || r.status}`)); } catch (e) { testOut.replaceChildren(notice('bad', e.message)); }
  });
  const prompt = el('textarea', { name: 'ai_system_prompt', rows: 4, maxlength: 2000, placeholder: 'Optional extra guidance, e.g. tone, denominational perspective, what to avoid.' }); prompt.value = v.ai_system_prompt;
  const f = el('form', { class: 'form' },
    el('p', { class: st.ai.ready ? 'note ok' : 'note' }, st.ai.ready ? 'Status: ON — the assistant is available in the app.' : 'Status: OFF — turn it on and complete vendor, model and key.'),
    check('ai_enabled', v.ai_enabled, 'Enable the AI assistant in the app'),
    field('Vendor', vendorSel), base,
    field('Model', modelIn, 'Use a model id from your vendor’s dashboard. A small, fast model keeps costs low.'),
    field('API key', keyIn, 'Stored encrypted on the server, never sent to browsers, never shown again. Changing ADMIN_TOKEN requires entering it again.'), clearKey,
    el('h3', {}, 'Cost and abuse limits'),
    el('div', { class: 'row2' },
      field('Questions per minute (per visitor IP)', num('ai_per_minute', v.ai_per_minute, 1, 30)),
      field('Questions per day (per visitor IP)', num('ai_daily_per_ip', v.ai_daily_per_ip, 1, 500)),
      field('Questions per day (whole app — hard cap)', num('ai_daily_global', v.ai_daily_global, 1, 1000000)),
      field('Max answer length (tokens)', num('ai_max_tokens', v.ai_max_tokens, 64, 4000))),
    field('Extra instructions', prompt),
    el('p', { class: 'sub' }, 'Privacy: when a visitor asks a question, their question and the verse text shown are sent to the selected vendor. Mention this in your privacy policy. No account, IP or device id is forwarded.'),
    el('div', { class: 'btns' }, el('button', { type: 'submit' }, 'Save AI settings'), test), testOut, out);
  sync();
  f.addEventListener('submit', (e) => { e.preventDefault(); submit(f, v, out, (n) => { settings = n; show(); }); });
  const use = st.ai.usage;
  const usage = card('AI requests (30 days)', use.length ? bars(fill30(use.map((r) => ({ day: r.day, n: r.n })), 'n'), 'n', 'AI requests per day') : el('div', { class: 'sub' }, 'No requests yet'),
    el('p', { class: 'sub' }, `Today: ${n(use.find((r) => r.day === new Date().toISOString().slice(0, 10))?.n ?? 0)} of ${n(v.ai_daily_global)} allowed · refused by the cap: ${n(use.reduce((a, r) => a + r.refused, 0))}`));
  return [card('AI assistant', f), usage];
}

// --- Data & privacy ---
function dataTab(st) {
  const v = st.values;
  const out = el('div');
  const f = el('form', { class: 'form' },
    check('events_enabled', v.events_enabled, 'Collect anonymous usage statistics (only from visitors who opted in)'),
    field('Keep statistics for (days, 30–400)', num('retention_days', v.retention_days, 30, 400), 'Older events are deleted automatically. Your privacy policy promises up to 400 days.'),
    el('button', { type: 'submit' }, 'Save'), out);
  f.addEventListener('submit', (e) => { e.preventDefault(); submit(f, v, out, (n2) => { settings = n2; show(); }); });
  const dout = el('div');
  const conf = text('confirm', '', { placeholder: 'type DELETE' });
  const del = el('button', { type: 'button', class: 'danger' }, 'Delete all statistics now');
  del.addEventListener('click', async () => { try { await api('/api/admin/purge', 'POST', { confirm: conf.value }); dout.replaceChildren(notice('ok', 'All statistics deleted.')); conf.value = ''; } catch (e) { dout.replaceChildren(notice('bad', e.message)); } });
  return [card('Statistics collection', f), card('Danger zone', el('p', { class: 'sub' }, 'Permanently deletes every stored event and device summary. Settings are kept. This cannot be undone.'), el('div', { class: 'btns' }, conf, del), dout)];
}

let settings = null;
let flash = '';
async function show() {
  const head = nav();
  try {
    let body;
    if (tab === 'analytics') body = renderAnalytics(await api('/api/admin/stats'));
    else {
      settings ??= await api('/api/admin/settings');
      body = tab === 'pixels' ? pixelsTab(settings) : tab === 'ai' ? aiTab(settings) : dataTab(settings);
      $('#gen').textContent = '';
    }
    app.replaceChildren(head, ...body);
    if (flash) { app.querySelector('form')?.append(notice('ok', flash)); flash = ''; }
    $('#out').hidden = false;
  } catch (err) { throw err; }
}

$('#f').addEventListener('submit', async (e) => {
  e.preventDefault();
  token = $('#tok').value;
  try { await show(); } catch (err) { token = ''; $('#err').textContent = err.message; }
});
$('#out').addEventListener('click', () => { token = ''; location.reload(); });
// Auto-refresh only the analytics tab, so a form being edited is never wiped.
setInterval(() => { if (token && tab === 'analytics') show().catch(() => undefined); }, 60000);
