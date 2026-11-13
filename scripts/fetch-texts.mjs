// Downloads Bible text files into server/texts so the app serves them from your own domain
// (no dependency on a third-party CDN, which some networks block).
//   node scripts/fetch-texts.mjs            all versions in the catalog
//   node scripts/fetch-texts.mjs ar_kehm en_web
import { mkdir, writeFile, stat, rename } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('app/src/data/catalog.json', root), 'utf8'));
const out = process.env.TEXTS_DIR ? new URL(`file://${process.env.TEXTS_DIR.replace(/\/?$/, '/')}`) : new URL('server/texts/', root);
await mkdir(out, { recursive: true });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : catalog.versions.map((v) => v.id);
let ok = 0, fail = 0;
const one = async (id) => {
  if (!/^[a-z]{2,3}_[a-z0-9-]+$/.test(id)) return console.error('skip', id);
  const file = new URL(`${id}.json`, out);
  if (await stat(file).then((s) => s.size > 1000, () => false)) { ok++; return; }
  const urls = [`https://cdn.jsdelivr.net/gh/thiagobodruk/bible@${catalog.sha}/json/${id}.json`, `https://raw.githubusercontent.com/thiagobodruk/bible/${catalog.sha}/json/${id}.json`];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const text = (await r.text()).replace(/^﻿/, '');
      if (!Array.isArray(JSON.parse(text))) continue;
      const tmp = new URL(`${id}.json.part`, out);
      await writeFile(tmp, text);
      await rename(tmp, file); // never leave a half-written text that the size check would keep forever
      ok++;
      return;
    } catch { /* try next */ }
  }
  fail++;
  console.error('failed', id);
};
const queue = [...ids];
await Promise.all(Array.from({ length: 4 }, async () => { for (let id; (id = queue.shift());) await one(id); }));
console.log(`done: ${ok} ok, ${fail} failed -> ${fileURLToPath(out)}`);
process.exit(fail ? 1 : 0);
