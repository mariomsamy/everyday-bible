// Generates src/data/catalog.json from the thiagobodruk/bible repo, pinned to a commit.
// Uso: node scripts/build-catalog.mjs [sha]
import { writeFile } from 'node:fs/promises';

const SHA = process.argv[2] ?? '92e121c2c829eae351b76db1d32858ced77b16a6';
const CDN = `https://cdn.jsdelivr.net/gh/thiagobodruk/bible@${SHA}/json`;
const RTL = new Set(['ar', 'he', 'fa', 'ur', 'yi', 'ckb']);

const get = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  throw new Error(`falha ao baixar ${url}`);
};

const index = await (await get(`${CDN}/index.json`)).json();
const jobs = index.flatMap((g) => g.versions.map((v) => ({ ...v, language: g.language })));
const out = [];
let next = 0;

async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    const buf = await (await get(`${CDN}/${job.abbreviation}.json`)).arrayBuffer();
    const books = JSON.parse(new TextDecoder().decode(buf).replace(/^﻿/, ''));
    const ids = books.map((b) => b.abbrev);
    const lang = job.abbreviation.split('_')[0];
    out.push({
      id: job.abbreviation,
      lang,
      name: job.name,
      sizeMb: Math.round((buf.byteLength / 1048576) * 10) / 10,
      books: books.length,
      ...(books.length < 66 ? { coverage: books.length === 27 ? 'nt' : books.length === 39 ? 'ot' : 'partial' } : {}),
      ...(RTL.has(lang) ? { rtl: true } : {}),
    });
    process.stdout.write(`\r${out.length}/${jobs.length} ${job.abbreviation}      `);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

out.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(new URL('../src/data/catalog.json', import.meta.url), JSON.stringify({ sha: SHA, versions: out }, null, 1) + '\n');
console.log(`\n${out.length} versions, sha ${SHA}`);
