import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './index.mjs';
import { cleanProps, parseEvents, pixelConfig, contentSecurityPolicy } from './validate.mjs';
import { parseRef } from './og.mjs';

let app, base, dir;
const DID = 'a1b2c3d4-e5f6-4789-a012-b3c4d5e6f7a8';
const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'bible-'));
  mkdirSync(join(dir, 'dist/data'), { recursive: true });
  mkdirSync(join(dir, 'texts'), { recursive: true });
  mkdirSync(join(dir, 'dist/assets'), { recursive: true });
  writeFileSync(join(dir, 'dist/index.html'), '<!doctype html><html><head><title>App</title><meta name="description" content="x"><meta property="og:title" content="x"><meta property="og:description" content="x"></head><body></body></html>');
  writeFileSync(join(dir, 'dist/assets/a.js'), 'console.log(1)');
  writeFileSync(join(dir, 'secret.txt'), 'TOP SECRET');
  writeFileSync(join(dir, 'texts/en_kjv.json'), JSON.stringify([{ abbrev: 'jo', name: 'John', chapters: [['a <b>one</b>', 'two']] }]));
  app = createApp({ dist: join(dir, 'dist'), textsDir: join(dir, 'texts'), dbPath: join(dir, 't.sqlite'), env: { ADMIN_TOKEN: 'tok-123-long-enough-1', META_PIXEL_ID: '1234567890' } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });

test('validation: props are whitelisted and clamped', () => {
  assert.deepEqual(cleanProps({ book: 'gn', text: 'In the beginning', ip: '1.2.3.4' }, ['book']), { book: 'gn' });
  assert.deepEqual(cleanProps({ book: 'In the beginning God created' }, ['book']), {}, 'sentences are rejected');
  assert.deepEqual(cleanProps({ book: { x: 1 } }, ['book']), {});
  assert.deepEqual(cleanProps(JSON.parse('{"__proto__":{"book":"x"}}'), ['book']), {});
  assert.equal(parseEvents({ did: 'short', events: [] }), null);
  const p = parseEvents({ did: DID, events: [{ n: 'chapter_read', p: { book: 'gn' }, t: 1 }, { n: 'Bad Name' }, { n: 'note', p: { text: 'secret' } }, 'x'] }, 10_000_000_000);
  assert.equal(p.events.length, 1);
  assert.ok(p.events[0].ts >= 10_000_000_000 - 86_400_000, 'old client timestamps are clamped');
});

test('pixel ids and CSP', () => {
  assert.deepEqual(pixelConfig({ META_PIXEL_ID: '123456', TIKTOK_PIXEL_ID: '"><script>', GA4_ID: 'G-ABC123' }), { meta: '123456', ga4: 'G-ABC123' });
  const csp = contentSecurityPolicy({ meta: '1234' });
  assert.match(csp, /script-src 'self' https:\/\/connect\.facebook\.net/);
  assert.doesNotMatch(csp, /tiktok|googletagmanager|unsafe-inline'? ?[^;]*script/);
  assert.doesNotMatch(contentSecurityPolicy({}), /facebook/);
});

test('short admin token disables the dashboard', async () => {
  const dir2 = mkdtempSync(join(tmpdir(), 'bible2-'));
  const a2 = createApp({ dist: join(dir, 'dist'), dbPath: join(dir2, 't.sqlite'), env: { ADMIN_TOKEN: 'short' } });
  await new Promise((r) => a2.server.listen(0, '127.0.0.1', r));
  const r = await fetch(`http://127.0.0.1:${a2.server.address().port}/api/admin/stats`, { headers: { Authorization: 'Bearer short' } });
  assert.equal(r.status, 503);
  await a2.close();
  rmSync(dir2, { recursive: true, force: true });
});

test('parseRef accepts valid refs only', () => {
  assert.deepEqual(parseRef('en_kjv/jo/3/16-17'), { version: 'en_kjv', book: 'jo', chapter: 3, from: 16, to: 17 });
  assert.equal(parseRef('../../etc/passwd'), null);
  assert.equal(parseRef('en_kjv/jo/x'), null);
  assert.doesNotThrow(() => parseRef('en_kjv/%zz/3'));
});

test('security headers on every response, config exposes only pixel ids', async () => {
  const r = await fetch(base + '/api/config');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { pixels: { meta: '1234567890' }, ai: { enabled: false }, cdn: true });
  for (const h of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'strict-transport-security']) assert.ok(r.headers.get(h), h);
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});

test('events: stored, validated, size-limited, cross-origin refused', async () => {
  const ok = await post('/api/e', { did: DID, events: [{ n: 'chapter_read', p: { book: 'gn' }, t: Date.now() }, { n: 'chapter_read', p: { book: 'gn' } }, { n: 'share', p: { channel: 'whatsapp' } }, { n: 'progress', p: { read: 12, pct: 1.2, streak: 3, plan_days: 90, pace: 'onTrack' } }] });
  assert.equal(ok.status, 204);
  assert.equal((await post('/api/e', { did: 'x', events: [] })).status, 400);
  assert.equal((await post('/api/e', 'not json')).status, 400);
  assert.equal((await post('/api/e', { did: DID, events: [], pad: 'x'.repeat(20_000) })).status, 413);
  assert.equal((await post('/api/e', { did: DID, events: [{ n: 'x_y' }] }, { origin: 'https://evil.example' })).status, 403);
  assert.equal(app.db.prepare('SELECT COUNT(*) c FROM events').get().c, 4);
  // the stored rows contain no ip/user agent columns at all
  assert.deepEqual(app.db.prepare('PRAGMA table_info(events)').all().map((c) => c.name), ['id', 'ts', 'day', 'did', 'name', 'props']);
});

test('admin: disabled without token header, works with it, no token in URL support', async () => {
  assert.equal((await fetch(base + '/api/admin/stats')).status, 401);
  assert.equal((await fetch(base + '/api/admin/stats', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await fetch(base + '/api/admin/stats?token=tok-123-long-enough-1')).status, 401);
  const r = await fetch(base + '/api/admin/stats', { headers: { Authorization: 'Bearer tok-123-long-enough-1' } });
  assert.equal(r.status, 200);
  const s = await r.json();
  assert.equal(s.users.total, 1);
  assert.equal(s.topBooks[0].k, 'gn');
  assert.equal(s.topBooks[0].n, 2);
  assert.equal(s.shares[0].k, 'whatsapp');
  assert.equal(s.progress.withPlan, 1);
  assert.equal(s.pixels.meta, true);
});

test('forget deletes everything for the device', async () => {
  assert.equal((await post('/api/forget', { did: 'bad' })).status, 400);
  assert.equal((await post('/api/forget', { did: DID })).status, 200);
  assert.equal(app.db.prepare('SELECT COUNT(*) c FROM events').get().c, 0);
  assert.equal(app.db.prepare('SELECT COUNT(*) c FROM devices').get().c, 0);
});

test('static: traversal blocked, SPA fallback, shared-verse preview is escaped', async () => {
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/assets/../../secret.txt']) {
    const r = await fetch(base + p);
    assert.notEqual(await r.text(), 'TOP SECRET', p);
  }
  const spa = await fetch(base + '/en_kjv/jo/1');
  assert.equal(spa.status, 200);
  const og = await (await fetch(base + '/?ref=en_kjv/jo/1/1-2')).text();
  assert.match(og, /<title>John 1:1-2<\/title>/);
  assert.match(og, /a &lt;b&gt;one&lt;\/b&gt; two/);
  assert.doesNotMatch(og, /<b>one<\/b>/);
  assert.equal((await fetch(base + '/?ref=en_kjv/%25zz/3/16')).status, 200);
  const dollar = await (await fetch(base + '/?ref=en_kjv/jo/1/1&x=$%26')).text();
  assert.equal(dollar.match(/<\/head>/g).length, 1);
  assert.equal((await fetch(base + '/missing.js')).status, 404);
  const asset = await fetch(base + '/assets/a.js');
  assert.match(asset.headers.get('cache-control'), /immutable/);
});

// ---- admin settings + AI proxy ----
import { safeBaseUrl, encrypt, decrypt } from './settings.mjs';
import { buildPrompt, aiReady } from './ai.mjs';
const AUTH = { Authorization: 'Bearer tok-123-long-enough-1', 'Content-Type': 'application/json' };

test('safeBaseUrl: https only, no IPs or internal hosts', () => {
  assert.equal(safeBaseUrl('https://api.example.com/v1/'), 'https://api.example.com/v1');
  for (const bad of ['http://api.example.com', 'https://127.0.0.1/v1', 'https://localhost/x', 'https://intranet.local/x', 'https://a.com/?k=1', 'https://u:p@a.com', 'ftp://a.com']) assert.equal(safeBaseUrl(bad), undefined, bad);
});

test('secrets are encrypted at rest and need the same admin token', () => {
  const blob = encrypt('sk-test-123456789', 'tok');
  assert.doesNotMatch(blob, /sk-test/);
  assert.equal(decrypt(blob, 'tok'), 'sk-test-123456789');
  assert.equal(decrypt(blob, 'other'), '');
});

test('buildPrompt limits input and ignores bad roles', () => {
  assert.equal(buildPrompt({ question: '   ' }, {}), null);
  const p = buildPrompt({ question: 'x'.repeat(5000), lang: '<bad>', passage: { ref: 'Jn 3', text: 't'.repeat(99999) }, history: [{ role: 'system', content: 'evil' }, { role: 'user', content: 'hi' }] }, { ai_system_prompt: 'Be brief' });
  assert.equal(p.messages.length, 2);
  assert.equal(p.messages[1].content.length, 1000);
  assert.match(p.system, /language with code "en"/);
  assert.ok(p.system.length < 8000 && p.system.includes('Be brief'));
  assert.equal(aiReady({ ai_enabled: true, ai_vendor: 'anthropic', ai_api_key: 'k'.repeat(10) }), true);
  assert.equal(aiReady({ ai_enabled: true, ai_vendor: 'custom', ai_api_key: 'k'.repeat(10), ai_model: 'm' }), false);
});

test('admin settings API: auth, validation, secret never returned, config reflects pixels', async () => {
  assert.equal((await fetch(`${base}/api/admin/settings`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/settings`, { headers: { Authorization: 'Bearer wrong-wrong-wrong-1' } })).status, 401);
  const bad = await fetch(`${base}/api/admin/settings`, { method: 'PUT', headers: AUTH, body: JSON.stringify({ meta_pixel_id: '"><script>', nope: 1 }) });
  assert.equal(bad.status, 400);
  const ok = await fetch(`${base}/api/admin/settings`, { method: 'PUT', headers: AUTH, body: JSON.stringify({ ga4_id: 'G-TEST1234', ai_enabled: true, ai_vendor: 'anthropic', ai_api_key: 'sk-ant-SECRETVALUE123' }) });
  assert.equal(ok.status, 200);
  const txt = await ok.text();
  assert.doesNotMatch(txt, /SECRETVALUE/, 'API key must never be returned');
  const j = JSON.parse(txt);
  assert.equal(j.secrets.ai_api_key.set, true);
  assert.equal(j.ai.ready, true);
  const cfg = await (await fetch(`${base}/api/config`)).json();
  assert.equal(cfg.pixels.ga4, 'G-TEST1234');
  assert.equal(cfg.pixels.meta, '1234567890', 'env value still applies when not overridden');
  assert.equal(cfg.ai.enabled, true);
  assert.doesNotMatch(JSON.stringify(cfg), /SECRETVALUE/);
  const csp = (await fetch(`${base}/`)).headers.get('content-security-policy');
  assert.match(csp, /googletagmanager/, 'CSP follows the admin pixel settings');
  // Cross-site writes are refused
  const xs = await fetch(`${base}/api/admin/settings`, { method: 'PUT', headers: { ...AUTH, Origin: 'https://evil.example' }, body: '{}' });
  assert.equal(xs.status, 403);
  // reset
  await fetch(`${base}/api/admin/settings`, { method: 'PUT', headers: AUTH, body: JSON.stringify({ ga4_id: null, ai_enabled: false, ai_api_key: null }) });
  assert.equal((await (await fetch(`${base}/api/config`)).json()).ai.enabled, false);
});

test('AI endpoint is closed unless enabled, and validates input', async () => {
  const r = await fetch(`${base}/api/ai/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'hi' }) });
  assert.equal(r.status, 503);
});

test('purge needs the typed confirmation', async () => {
  assert.equal((await fetch(`${base}/api/admin/purge`, { method: 'POST', headers: AUTH, body: JSON.stringify({ confirm: 'yes' }) })).status, 400);
  assert.equal((await fetch(`${base}/api/admin/purge`, { method: 'POST', headers: AUTH, body: JSON.stringify({ confirm: 'DELETE' }) })).status, 200);
});

test('streamAnswer converts both vendor formats to OpenAI deltas (mocked, no network)', async () => {
  const { streamAnswer, errorFor } = await import('./ai.mjs');
  const realFetch = globalThis.fetch;
  const body = (lines) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(lines.join('\n') + '\n')); c.close(); } }), { status: 200 });
  const run = async (s, lines) => {
    let seen;
    globalThis.fetch = async (url, init) => { seen = { url: String(url), init }; return body(lines); };
    const out = [];
    const r = await streamAnswer(s, { system: 'sys', messages: [{ role: 'user', content: 'q' }] }, { signal: undefined, write: (c) => out.push(c) });
    return { r, out: out.join(''), seen };
  };
  try {
    const a = await run({ ai_vendor: 'anthropic', ai_api_key: 'k'.repeat(10), ai_model: '', ai_max_tokens: 50 }, [
      'event: content_block_delta', 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}', 'data: {"type":"message_stop"}']);
    assert.ok(a.r.ok);
    assert.match(a.out, /"content":"Hel"/);
    assert.match(a.out, /\[DONE\]/);
    assert.equal(a.seen.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(a.seen.init.headers['x-api-key'], 'k'.repeat(10));
    assert.equal(JSON.parse(a.seen.init.body).system, 'sys');
    const o = await run({ ai_vendor: 'openai', ai_api_key: 'k'.repeat(10), ai_model: 'm1', ai_max_tokens: 50 }, [
      'data: {"choices":[{"delta":{"content":"Hi"}}],"usage":{"secret":1}}', 'data: [DONE]']);
    assert.match(o.out, /"content":"Hi"/);
    assert.doesNotMatch(o.out, /usage/, 'vendor metadata is not forwarded');
    assert.equal(JSON.parse(o.seen.init.body).max_completion_tokens, 50);
    assert.equal(o.seen.init.headers.authorization, 'Bearer ' + 'k'.repeat(10));
    globalThis.fetch = async () => new Response('x', { status: 401 });
    const bad = await streamAnswer({ ai_vendor: 'openai', ai_api_key: 'k'.repeat(10), ai_model: 'm' }, { system: 's', messages: [] }, { write() {} });
    assert.deepEqual([bad.ok, errorFor(bad.status).error, errorFor(429).error], [false, 'config', 'quota']);
  } finally { globalThis.fetch = realFetch; }
});

// ---- regression tests for the security-audit fixes ----
import { mock } from 'node:test';
import { openDb as openDb2, admitEvents as admit2, recordEvents as rec2, stats as stats2 } from './db.mjs';
import { saveSettings, loadSettings } from './settings.mjs';
import { injectPreview, previewFor } from './og.mjs';
import { gunzipSync } from 'node:zlib';
import { writeFileSync as wf, mkdtempSync as mkd, mkdirSync as mkdir, rmSync as rm } from 'node:fs';
import { tmpdir as td } from 'node:os';
import { join as j } from 'node:path';

test('og:url: $-patterns from the request URL are not expanded', () => {
  const html = '<!doctype html><html lang="ar"><head><title>x</title></head><body></body></html>';
  const out = injectPreview(html, { title: 't', description: 'd' }, 'http://x/?ref=en_kjv/jo/1/1&x=$`ZZZ$&');
  assert.equal(out.split('<!doctype').length - 1, 1, 'head must not be duplicated');
  assert.ok(out.includes('$`ZZZ$&amp;') || out.includes('$`ZZZ$&'), 'dollar sequences stay literal');
  assert.equal(out.split('</head>').length - 1, 1);
});

test('previewFor: made-up ids never evict real cached versions and hits refresh', () => {
  const d = mkd(j(td(), 'bible-og-'));
  wf(j(d, 'en_kjv.json'), JSON.stringify([{ abbrev: 'jo', name: 'John', chapters: [['In the beginning']] }]));
  assert.ok(previewFor(d, 'en_kjv/jo/1/1'));
  rm(j(d, 'en_kjv.json'));
  for (let i = 0; i < 20; i++) previewFor(d, `xx_fake${i}/jo/1/1`); // regex-valid but missing
  assert.ok(previewFor(d, 'en_kjv/jo/1/1'), 'still served from cache after 20 made-up ids');
  rm(d, { recursive: true, force: true });
});

test('API key is bound to its vendor: repointing vendor/base URL needs the key again', () => {
  const dir3 = mkd(j(td(), 'bible-set-'));
  const db3 = openDb2(j(dir3, 't.sqlite'));
  const S = 'secret-secret-secret-1';
  assert.ok(saveSettings(db3, { ai_enabled: true, ai_vendor: 'openai', ai_model: 'm', ai_api_key: 'DUMMYKEY12345678' }, S).ok);
  const bad = saveSettings(db3, { ai_vendor: 'custom', ai_base_url: 'https://collector.example' }, S);
  assert.equal(bad.ok, false);
  assert.match(bad.errors.ai_api_key, /re-enter/);
  assert.equal(loadSettings(db3, S).ai_vendor, 'openai', 'nothing was written');
  assert.ok(saveSettings(db3, { ai_vendor: 'custom', ai_base_url: 'https://api.example.com/v1', ai_api_key: 'NEWKEY123456789' }, S).ok, 'changing with a new key works');
  assert.ok(saveSettings(db3, { ai_model: 'other' }, S).ok, 'unrelated changes keep the key');
  assert.equal(loadSettings(db3, S).ai_api_key, 'NEWKEY123456789');
  db3.close(); rm(dir3, { recursive: true, force: true });
});

test('safeBaseUrl: trailing-dot hostnames are treated like the dotless name', () => {
  for (const bad of ['https://localhost./x', 'https://metadata.google.internal./x', 'https://box.local./x']) assert.equal(safeBaseUrl(bad), undefined, bad);
});

test('event storage is bounded per device and per day', () => {
  const dir4 = mkd(j(td(), 'bible-ev-'));
  const db4 = openDb2(j(dir4, 't.sqlite'));
  const lim = { perDevice: 10, budget: 25 };
  const evs = (n) => Array.from({ length: n }, () => ({ name: 'chapter_read', props: { book: 'gn' }, ts: Date.now() }));
  const did = 'a'.repeat(20), did2 = 'b'.repeat(20), did3 = 'c'.repeat(20);
  let room = admit2(db4, did, 50, lim); assert.equal(room, 10); rec2(db4, did, evs(room));
  room = admit2(db4, did, 50, lim); assert.equal(room, 0, 'device is at its daily cap');
  room = admit2(db4, did2, 50, lim); assert.equal(room, 10); rec2(db4, did2, evs(room));
  room = admit2(db4, did3, 50, lim); assert.equal(room, 5, 'only the remaining app budget is left'); rec2(db4, did3, evs(room));
  assert.equal(admit2(db4, 'd'.repeat(20), 5, lim), 0, 'app budget used up');
  db4.close(); rm(dir4, { recursive: true, force: true });
});

test('stats aggregate inside SQLite and stay correct', () => {
  const dir5 = mkd(j(td(), 'bible-st-'));
  const db5 = openDb2(j(dir5, 't.sqlite'));
  const mk = (book, n) => Array.from({ length: n }, () => ({ name: 'chapter_read', props: { book }, ts: Date.now() }));
  rec2(db5, 'x'.repeat(20), [...mk('gn', 3), ...mk('jo', 5)]);
  const s5 = stats2(db5);
  assert.deepEqual(s5.topBooks.slice(0, 2), [{ k: 'jo', n: 5 }, { k: 'gn', n: 3 }]);
  db5.close(); rm(dir5, { recursive: true, force: true });
});

test('serving: gzip works off-loop, plain streaming works, /texts is rate limited, bad did types are 400', async () => {
  const d6 = mkd(j(td(), 'bible-sv-'));
  mkdir(j(d6, 'dist/assets'), { recursive: true }); mkdir(j(d6, 'texts'), { recursive: true });
  wf(j(d6, 'dist/index.html'), '<!doctype html><html><head></head><body></body></html>');
  const big = JSON.stringify([{ abbrev: 'jo', name: 'John', chapters: [['x'.repeat(100000)]] }]);
  wf(j(d6, 'texts/en_kjv.json'), big);
  const a6 = createApp({ dist: j(d6, 'dist'), textsDir: j(d6, 'texts'), dbPath: j(d6, 't.sqlite'), env: { ADMIN_TOKEN: 'tok-123-long-enough-1' } });
  await new Promise((r) => a6.server.listen(0, '127.0.0.1', r));
  const b6 = `http://127.0.0.1:${a6.server.address().port}`;
  const gz = await fetch(`${b6}/texts/en_kjv.json`, { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(gz.status, 200);
  assert.equal(gz.headers.get('content-encoding'), 'gzip');
  const plain = await fetch(`${b6}/texts/en_kjv.json`, { headers: { 'Accept-Encoding': 'identity' } });
  assert.equal(plain.status, 200);
  assert.equal((await plain.text()).length, big.length);
  const bad = await fetch(`${b6}/api/e`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ did: ['a'.repeat(20)], events: [] }) });
  assert.equal(bad.status, 400, 'array did is rejected, not a 500');
  let limited429 = false;
  for (let i = 0; i < 320 && !limited429; i++) limited429 = (await fetch(`${b6}/texts/en_kjv.json`, { method: 'HEAD' })).status === 429;
  assert.ok(limited429, '/texts has a rate limit');
  await a6.close(); rm(d6, { recursive: true, force: true });
});

test('AI per-IP daily limit survives the hourly sweep (24h window is honoured)', async () => {
  const d7 = mkd(j(td(), 'bible-ai-'));
  mkdir(j(d7, 'dist'), { recursive: true }); wf(j(d7, 'dist/index.html'), '<!doctype html><html><head></head><body></body></html>');
  mock.timers.enable({ apis: ['Date', 'setInterval'] });
  const realFetch = globalThis.fetch;
  let app7;
  try {
    app7 = createApp({ dist: j(d7, 'dist'), textsDir: j(d7, 'texts'), dbPath: j(d7, 't.sqlite'), env: { ADMIN_TOKEN: 'tok-123-long-enough-1' } });
    await new Promise((r) => app7.server.listen(0, '127.0.0.1', r));
    const b7 = `http://127.0.0.1:${app7.server.address().port}`;
    const put = await realFetch(`${b7}/api/admin/settings`, { method: 'PUT', headers: { Authorization: 'Bearer tok-123-long-enough-1', 'Content-Type': 'application/json' }, body: JSON.stringify({ ai_enabled: true, ai_vendor: 'openai', ai_model: 'm', ai_api_key: 'DUMMYKEY12345678', ai_daily_per_ip: 2, ai_per_minute: 30 }) });
    assert.equal(put.status, 200);
    globalThis.fetch = (url, init) => (String(url).startsWith(b7) ? realFetch(url, init) : Promise.resolve(new Response('x', { status: 401 })));
    const ask = () => realFetch(`${b7}/api/ai/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'hi' }) });
    assert.notEqual((await ask()).status, 429);
    assert.notEqual((await ask()).status, 429);
    assert.equal((await ask()).status, 429, 'third question is over the daily limit');
    mock.timers.tick(3_700_000); // the 10-minute sweep has now run several times
    const after = await ask();
    assert.equal(after.status, 429, 'still limited after the sweep');
    assert.equal((await after.json()).error, 'daily_limit');
  } finally {
    globalThis.fetch = realFetch; mock.timers.reset();
    if (app7) await app7.close();
    rm(d7, { recursive: true, force: true });
  }
});

test('admin page gets its own tight CSP; low-entropy admin tokens keep the dashboard disabled', async () => {
  const r = await fetch(`${base}/admin`);
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /default-src 'none'/);
  assert.doesNotMatch(csp, /facebook|googletagmanager|jsdelivr/);
  const d8 = mkd(j(td(), 'bible-tk-'));
  const weak = createApp({ dist: join(dir, 'dist'), dbPath: j(d8, 't.sqlite'), env: { ADMIN_TOKEN: 'aaaaaaaaaaaaaaaaaaaaaaaa' } });
  await new Promise((r2) => weak.server.listen(0, '127.0.0.1', r2));
  const w = await fetch(`http://127.0.0.1:${weak.server.address().port}/api/admin/stats`, { headers: { Authorization: 'Bearer aaaaaaaaaaaaaaaaaaaaaaaa' } });
  assert.equal(w.status, 503);
  await weak.close(); rm(d8, { recursive: true, force: true });
});
