// Backend + static host for the Bible PWA. Zero dependencies (Node >= 22.5).
//  - serves app/dist (the built PWA) with security headers
//  - POST /api/e        anonymous events (only stored if the browser sent them after opt-in)
//  - POST /api/forget   deletes everything for one device id
//  - GET  /api/config   third-party pixel IDs (the browser only loads them after the marketing opt-in)
//  - GET  /api/admin/stats  aggregate analytics (Bearer ADMIN_TOKEN) and /admin dashboard
import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, statSync, createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { pipeline } from 'node:stream';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { openDb, recordEvents, admitEvents, forget, purge, stats, bumpAiUsage, refuseAiUsage, aiUsage, purgeAll } from './db.mjs';
import { loadSettings, saveSettings, publicView, effectivePixelEnv } from './settings.mjs';
import { aiReady, buildPrompt, streamAnswer, errorFor, VENDORS } from './ai.mjs';
import { contentSecurityPolicy, DID_RE, parseEvents, pixelConfig } from './validate.mjs';
import { injectPreview, previewFor } from './og.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function createApp(opts = {}) {
  const env = opts.env ?? process.env;
  const dist = opts.dist ?? join(ROOT, 'app/dist');
  const textsDir = opts.textsDir ?? env.TEXTS_DIR ?? join(ROOT, 'server/texts');
  const dbPath = opts.dbPath ?? env.DB_PATH ?? join(ROOT, 'server/data.sqlite');
  // A short token is brute-forceable: treat it as unset (dashboard disabled).
  // 16+ characters and not trivially repetitive (a low-entropy token is brute-forceable): otherwise the dashboard stays disabled.
  const adminToken = (env.ADMIN_TOKEN ?? '').length >= 16 && new Set(env.ADMIN_TOKEN).size >= 8 ? env.ADMIN_TOKEN : '';
  const trustProxy = env.TRUST_PROXY === '1'; // exactly one proxy hop; off by default
  const db = openDb(dbPath);
  // Settings edited in the admin page. Reloaded after every save; pixel ids there win over the environment.
  const secret = adminToken || 'admin-disabled';
  const cdn = env.CDN_FALLBACK !== '0'; // fail-safe default keeps downloads working; set 0 once texts are self-hosted
  let live, pixels, csp;
  const reload = () => {
    live = loadSettings(db, secret);
    pixels = pixelConfig(effectivePixelEnv(live, env));
    csp = contentSecurityPolicy(pixels, { cdn });
  };
  reload();
  purge(db, Date.now(), live.retention_days);
  const purgeTimer = setInterval(() => purge(db, Date.now(), live.retention_days), 6 * 3600_000);
  purgeTimer.unref();

  const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  };
  const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest', '.txt']);
  const gzCache = new Map();

  // ---- tiny fixed-window rate limiter keyed by the connection IP (never by a client header) ----
  const hits = new Map();
  const limited = (bucket, ip, max, windowMs) => {
    const k = `${bucket}|${ip}`;
    const now = Date.now();
    // Hard cap so spraying many addresses cannot grow memory without bound: drop the oldest entries.
    if (hits.size > 50_000) for (const key of hits.keys()) { hits.delete(key); if (hits.size <= 40_000) break; }
    const h = hits.get(k);
    if (!h || now - h.start > windowMs) { hits.set(k, { start: now, n: 1, w: windowMs }); return false; }
    h.n++;
    return h.n > max;
  };
  // Each entry expires after ITS OWN window (a 24 h AI counter must not be dropped after 1 h).
  const sweep = setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (now - h.start > h.w) hits.delete(k); }, 600_000);
  sweep.unref();

  const clientIp = (req) => {
    if (trustProxy) {
      const xff = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (xff.length) return xff[xff.length - 1];
    }
    return req.socket.remoteAddress ?? 'unknown';
  };
  // One client can own a whole IPv6 /64, so key those by prefix.
  const limitKey = (ip) => (ip.includes(':') && !ip.startsWith('::ffff:') ? ip.split(':').slice(0, 4).join(':') : ip);

  const baseHeaders = (extra = {}) => ({
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), payment=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cross-Origin-Opener-Policy': 'same-origin',
    ...extra,
  });

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, baseHeaders(headers));
    res.end(body);
  };
  const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });

  const readBody = (req, max = 16 * 1024) => new Promise((resolve, reject) => {
    // Reject by declared size before reading anything.
    if (Number(req.headers['content-length'] ?? 0) > max) { reject(Object.assign(new Error('too large'), { status: 413 })); return; }
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > max) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')); } catch { reject(Object.assign(new Error('bad json'), { status: 400 })); }
    });
    req.on('error', reject);
  });

  const sameOrigin = (req) => {
    const o = req.headers.origin;
    if (!o) return true; // sendBeacon/fetch from the same origin may omit it; cross-site POSTs always carry it
    try { return new URL(o).host === req.headers.host; } catch { return false; }
  };

  const digest = (s) => createHash('sha256').update(s).digest();
  const isAdmin = (req) => {
    if (!adminToken) return false;
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    return !!m && timingSafeEqual(digest(m[1]), digest(adminToken));
  };

  // Compression runs off the event loop, at most GZ_MAX at a time. Over that, the file is simply sent uncompressed.
  const gzipAsync = promisify(gzip);
  const GZ_MAX = 2;
  let gzActive = 0;
  const gzInflight = new Map();

  // The admin page needs nothing third-party: it gets its own, much tighter policy than the public app.
  const ADMIN_CSP = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

  async function serveFile(req, res, file, { immutable = false, noStore = false, csp: pageCsp } = {}) {
    const ext = extname(file);
    const st = statSync(file);
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      ETag: etag,
      'Cache-Control': noStore ? 'no-cache' : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      ...(pageCsp && { 'Content-Security-Policy': pageCsp }),
    };
    if (req.headers['if-none-match'] === etag) return send(res, 304, '', headers);
    const wantsGzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '') && st.size < 20 * 1024 * 1024;
    if (wantsGzip) {
      let gz = gzCache.get(file);
      if (gz && gz.etag === etag) {
        gzCache.delete(file); // LRU: a hit moves the entry to the newest position
        gzCache.set(file, gz);
      } else {
        const key = `${file}|${etag}`;
        let job = gzInflight.get(key);
        if (!job && gzActive < GZ_MAX) {
          gzActive++;
          job = readFile(file).then((b) => gzipAsync(b)).then((buf) => ({ etag, buf })).finally(() => { gzActive--; gzInflight.delete(key); });
          gzInflight.set(key, job);
        }
        if (job) {
          try { gz = await job; } catch { gz = null; }
          if (gz) {
            gzCache.delete(file);
            gzCache.set(file, gz);
            // Bounded cache (about 48 MB): drop the least recently used entries.
            let total = 0;
            for (const v of gzCache.values()) total += v.buf.length;
            for (const k of gzCache.keys()) { if (total <= 48 * 1024 * 1024 || gzCache.size <= 1) break; total -= gzCache.get(k).buf.length; gzCache.delete(k); }
          }
        }
      }
      if (gz) return send(res, 200, req.method === 'HEAD' ? '' : gz.buf, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      // Busy (or failed): fall through and send the file uncompressed.
    }
    res.writeHead(200, baseHeaders({ ...headers, 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    // pipeline() closes the file when the client goes away and contains read errors (no unhandled 'error', no leaked descriptor).
    pipeline(createReadStream(file), res, () => {});
  }

  const indexHtml = () => readFileSync(join(dist, 'index.html'), 'utf8');

  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://x');
    const path = url.pathname;
    const ip = limitKey(clientIp(req));

    if (path === '/healthz') return json(res, 200, { ok: true });

    // ---------- API ----------
    if (path === '/api/config' && req.method === 'GET') {
      res.writeHead(200, baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' }));
      return res.end(JSON.stringify({ pixels, ai: { enabled: aiReady(live) }, cdn }));
    }
    if (path === '/api/e' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'origin' });
      if (limited('e', ip, 120, 60_000)) return json(res, 429, { error: 'rate' });
      const parsed = parseEvents(await readBody(req));
      if (!parsed) return json(res, 400, { error: 'invalid' });
      if (live.events_enabled && parsed.events.length) {
        // Storage is bounded: per device per day and for the whole app per day (anything above is dropped silently).
        const room = admitEvents(db, parsed.did, parsed.events.length, { perDevice: live.events_per_device_day, budget: live.events_daily_budget });
        if (room > 0) recordEvents(db, parsed.did, parsed.events.slice(0, room));
      }
      res.writeHead(204, baseHeaders());
      return res.end();
    }
    if (path === '/api/forget' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'origin' });
      if (limited('forget', ip, 20, 3600_000)) return json(res, 429, { error: 'rate' });
      const body = await readBody(req);
      if (!body || typeof body.did !== 'string' || !DID_RE.test(body.did)) return json(res, 400, { error: 'invalid' });
      forget(db, body.did);
      return json(res, 200, { ok: true });
    }
    if (path === '/api/admin/stats' && req.method === 'GET') {
      // Count every attempt (not only failures) so a bad token cannot be brute-forced.
      if (limited('admin', ip, 60, 600_000)) return json(res, 429, { error: 'rate' });
      if (!adminToken) return json(res, 503, { error: 'admin disabled: set ADMIN_TOKEN' });
      if (!isAdmin(req)) return json(res, 401, { error: 'unauthorized' });
      return json(res, 200, { ...stats(db), pixels: Object.fromEntries(['meta', 'tiktok', 'snap', 'ga4'].map((k) => [k, !!pixels[k]])) });
    }
    // ---------- Admin: settings ----------
    const adminGate = () => {
      if (limited('admin', ip, 60, 600_000)) { json(res, 429, { error: 'rate' }); return false; }
      if (!adminToken) { json(res, 503, { error: 'admin disabled: set ADMIN_TOKEN' }); return false; }
      if (!isAdmin(req)) { json(res, 401, { error: 'unauthorized' }); return false; }
      return true;
    };
    const settingsReply = () => ({ ...publicView(live, env), ai: { ready: aiReady(live), usage: aiUsage(db), vendors: Object.fromEntries(Object.entries(VENDORS).map(([k, v]) => [k, { label: v.label, model: v.model ?? '' }])) } });
    if (path === '/api/admin/settings' && req.method === 'GET') {
      if (!adminGate()) return;
      return json(res, 200, settingsReply());
    }
    if (path === '/api/admin/settings' && req.method === 'PUT') {
      if (!adminGate()) return;
      if (!sameOrigin(req)) return json(res, 403, { error: 'origin' });
      const r = saveSettings(db, await readBody(req, 16 * 1024), secret);
      if (!r.ok) return json(res, 400, { error: 'invalid', fields: r.errors });
      reload();
      return json(res, 200, settingsReply());
    }
    if (path === '/api/admin/ai/test' && req.method === 'POST') {
      if (!adminGate()) return;
      if (!sameOrigin(req)) return json(res, 403, { error: 'origin' });
      if (!aiReady(live)) return json(res, 400, { ok: false, error: 'AI is not fully configured (enable it, pick a vendor, model and key).' });
      const t0 = Date.now();
      let sample = '';
      try {
        const r = await streamAnswer(live, { system: 'Reply with the single word OK.', messages: [{ role: 'user', content: 'ping' }] }, { signal: AbortSignal.timeout(20_000), maxTokens: 16, write: (c) => { if (sample.length < 40 && c.startsWith('data: {')) { try { sample += JSON.parse(c.slice(6)).choices[0].delta.content; } catch { /* [DONE] */ } } } });
        return json(res, 200, r.ok ? { ok: true, ms: Date.now() - t0, sample: sample.slice(0, 40) } : { ok: false, status: r.status, error: errorFor(r.status).error });
      } catch { return json(res, 200, { ok: false, error: 'network' }); }
    }
    if (path === '/api/admin/purge' && req.method === 'POST') {
      if (!adminGate()) return;
      if (!sameOrigin(req)) return json(res, 403, { error: 'origin' });
      const body = await readBody(req);
      if (body?.confirm !== 'DELETE') return json(res, 400, { error: 'type DELETE to confirm' });
      purgeAll(db);
      return json(res, 200, { ok: true });
    }

    // ---------- AI assistant (browser -> this server -> vendor) ----------
    if (path === '/api/ai/ask' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'origin' });
      if (!aiReady(live)) return json(res, 503, { error: 'disabled' });
      if (limited('ai-min', ip, live.ai_per_minute, 60_000)) return json(res, 429, { error: 'rate' });
      if (limited('ai-day', ip, live.ai_daily_per_ip, 86_400_000)) return json(res, 429, { error: 'daily_limit' });
      const prompt = buildPrompt(await readBody(req, 24 * 1024), live);
      if (!prompt) return json(res, 400, { error: 'invalid' });
      if (bumpAiUsage(db) > live.ai_daily_global) { refuseAiUsage(db); return json(res, 429, { error: 'quota' }); }
      const ctl = new AbortController();
      res.on('close', () => ctl.abort());
      let started = false;
      try {
        const r = await streamAnswer(live, prompt, {
          signal: AbortSignal.any([ctl.signal, AbortSignal.timeout(60_000)]),
          write: (chunk) => {
            if (!started) { started = true; res.writeHead(200, baseHeaders({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' })); }
            res.write(chunk);
          },
        });
        if (!r.ok) { const e = errorFor(r.status); console.error('ai upstream status', r.status); return json(res, e.code, { error: e.error }); }
        if (!started) return json(res, 502, { error: 'empty' });
        return res.end();
      } catch (err) {
        if (!started) return json(res, 502, { error: 'upstream' });
        return res.end(); // stream already begun: just close it
      }
    }

    if (path.startsWith('/api/')) return json(res, 404, { error: 'not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });

    // ---------- Admin dashboard (static; data needs the token) ----------
    if (path === '/admin' || path === '/admin/') return serveFile(req, res, join(ROOT, 'server/admin/index.html'), { noStore: true, csp: ADMIN_CSP });
    if (path === '/admin/admin.js') return serveFile(req, res, join(ROOT, 'server/admin/admin.js'), { noStore: true, csp: ADMIN_CSP });

    // ---------- Bible texts (self-hosted; fetched with scripts/fetch-texts.mjs) ----------
    const tm = /^\/texts\/([a-z]{2,3}_[a-z0-9-]+)\.json$/.exec(path);
    if (tm) {
      if (limited('static', ip, 300, 60_000)) return json(res, 429, { error: 'rate' });
      const f = join(textsDir, `${tm[1]}.json`);
      if (!existsSync(f)) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return await serveFile(req, res, f, {});
    }

    // ---------- Static app ----------
    if (!existsSync(join(dist, 'index.html'))) return send(res, 503, 'App not built. Run: npm run build', { 'Content-Type': 'text/plain; charset=utf-8' });
    let rel;
    try { rel = decodeURIComponent(path); } catch { return send(res, 400, 'Bad Request'); }
    if (rel.includes('\0')) return send(res, 400, 'Bad Request');
    const file = normalize(join(dist, rel));
    if (file !== dist && !file.startsWith(dist + sep)) return send(res, 403, 'Forbidden');
    if (rel !== '/' && existsSync(file) && statSync(file).isFile()) {
      if (limited('static', ip, 300, 60_000)) return json(res, 429, { error: 'rate' });
      const name = rel.slice(1);
      const noStore = ['sw.js', 'index.html', '404.html', 'version.json', 'early.js', 'manifest.webmanifest'].includes(name);
      return await serveFile(req, res, file, { immutable: name.startsWith('assets/'), noStore });
    }
    if (/\.\w{1,6}$/.test(rel)) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });

    if (limited('page', ip, 300, 60_000)) return send(res, 429, 'Too Many Requests');
    // SPA route: index.html, with a link preview when the URL points at a shared passage.
    let html = indexHtml();
    if (env.PUBLIC_URL) html = html.replaceAll('content="/og-thumb.png"', `content="${env.PUBLIC_URL.replace(/\/$/, '')}/og-thumb.png"`);
    const ref = url.searchParams.get('ref') ?? (rel === '/' ? null : rel);
    // Previews parse a whole Bible file, so they have a tighter limit than plain pages; over it the page is served without a preview.
    const preview = ref && !limited('preview', ip, 30, 60_000) ? previewFor(textsDir, ref) : null;
    if (preview) html = injectPreview(html, preview, `${env.PUBLIC_URL ?? `http://${req.headers.host}`}${req.url}`);
    return send(res, 200, req.method === 'HEAD' ? '' : html, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (res.headersSent) return res.destroy();
      const status = err?.status ?? 500;
      if (status === 500) console.error('error:', err?.message); // never log request bodies or ids
      json(res, status, { error: status === 500 ? 'server error' : err.message });
    });
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  const close = () => new Promise((r) => { clearInterval(purgeTimer); clearInterval(sweep); server.close(() => { db.close(); r(); }); server.closeAllConnections?.(); });
  return { server, db, close };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8080);
  const host = process.env.HOST ?? '127.0.0.1';
  const { server, close } = createApp();
  // Containers and systemd stop the process with SIGTERM: finish cleanly so SQLite is closed properly.
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { close().finally(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); });
  server.listen(port, host, () => {
    console.log(`Bible PWA on http://${host}:${port}`);
    if ((process.env.ADMIN_TOKEN ?? '').length < 16) console.log('ADMIN_TOKEN is missing or shorter than 16 characters: the dashboard (/admin) is disabled.');
  });
}
