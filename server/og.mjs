// Link previews for shared verses: injects Open Graph tags into index.html for /?ref=<version>/<book>/<chapter>/<verses>.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const safeDecode = (x) => { try { return decodeURIComponent(x); } catch { return ''; } };

/** "ar_bible/jo/3/16-17" -> { version, book, chapter, from, to } or null. */
export function parseRef(ref) {
  const m = /^\/?([a-z]{2,3}_[a-z0-9-]+)\/([^/]{1,6})\/(\d{1,3})(?:\/(\d{1,3})(?:-(\d{1,3}))?)?$/i.exec(String(ref ?? ''));
  if (!m) return null;
  const from = m[4] ? Number(m[4]) : undefined;
  const to = m[5] ? Number(m[5]) : from;
  return { version: m[1].toLowerCase(), book: safeDecode(m[2]).toLowerCase(), chapter: Number(m[3]), from, to };
}

const cache = new Map();
function loadVersion(dataDir, id) {
  if (cache.has(id)) return cache.get(id);
  const file = join(dataDir, `${id}.json`);
  const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  cache.set(id, data);
  if (cache.size > 3) cache.delete(cache.keys().next().value);
  return data;
}

export function previewFor(dataDir, ref) {
  const r = parseRef(ref);
  if (!r) return null;
  const data = loadVersion(dataDir, r.version);
  const b = data?.find((x) => x.abbrev === r.book);
  const ch = b?.chapters?.[r.chapter - 1];
  if (!ch) return null;
  const from = r.from ?? 1;
  const to = Math.min(r.to ?? (r.from ? r.from : Math.min(ch.length, 3)), ch.length);
  const text = ch.slice(from - 1, to).join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const range = r.from ? (to > from ? `${from}-${to}` : `${from}`) : '';
  return { title: `${b.name} ${r.chapter}${range ? `:${range}` : ''}`, description: text.length > 220 ? `${text.slice(0, 217)}…` : text };
}

export function injectPreview(html, p, url) {
  const t = esc(p.title);
  const d = esc(p.description);
  return html
    .replace(/<title>[^<]*<\/title>/, () => `<title>${t}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, () => `$1${t}"`)
    .replace(/(<meta name="twitter:title" content=")[^"]*"/, () => `$1${t}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, () => `$1${d}"`)
    .replace(/(<meta name="twitter:description" content=")[^"]*"/, () => `$1${d}"`)
    .replace(/(<meta name="description" content=")[^"]*"/, () => `$1${d}"`)
    .replace('</head>', `    <meta property="og:url" content="${esc(url)}" />\n  </head>`);
}
