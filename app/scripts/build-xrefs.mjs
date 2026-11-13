// Generates public/xrefs/<book>.json from the TSK (Treasury of Scripture Knowledge) module of the SWORD project,
// which is in the public domain. Usage: node scripts/build-xrefs.mjs [sha]
// Requires the `unzip` command. Versification comes from the KJV in the data repo, pinned to a commit.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const SHA = process.argv[2] ?? '92e121c2c829eae351b76db1d32858ced77b16a6';
const TSK_URL = 'https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/TSK.zip';
const KJV_URL = `https://cdn.jsdelivr.net/gh/thiagobodruk/bible@${SHA}/json/en_kjv.json`;
const LIMIT = 10;
// ASCII-only file name (the id for Job has an accent). Keep it identical to fileOf in src/data/xrefs.ts.
const fileOf = (id) => id.replace(/[^\x00-\x7f]/g, (c) => `u${c.charCodeAt(0).toString(16)}`);

// TSK abbreviations in canonical order; the ids come from the data repo, in the same order.
const TSK_BOOKS = 'Ge Ex Le Nu De Jos Jud Ru 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Ne Es Job Ps Pr Ec So Isa Jer La Eze Da Ho Joe Am Ob Jon Mic Na Hab Zep Hag Zec Mal Mt Mr Lu Joh Ac Ro 1Co 2Co Ga Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jo 2Jo 3Jo Jude Re'.split(' ');

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

const kjv = JSON.parse(new TextDecoder().decode(await (await get(KJV_URL)).arrayBuffer()).replace(/^﻿/, ''));
const ids = kjv.map((b) => b.abbrev);
const byTsk = Object.fromEntries(TSK_BOOKS.map((a, i) => [a, i]));
const shape = kjv.map((b) => b.chapters.map((c) => c.length));

// Reads the zlib blocks of the zCom module: the .bzv index has 10 bytes per verse, the .bzs 12 bytes per block.
function reader(dir, testament) {
  const base = join(dir, 'modules/comments/zcom/tsk', testament);
  return Promise.all(['bzv', 'bzs', 'bzz'].map((e) => readFile(`${base}.${e}`))).then(([bzv, bzs, bzz]) => {
    const cache = new Map();
    const block = (n) => {
      if (!cache.has(n)) {
        const o = bzs.readUInt32LE(n * 12);
        cache.set(n, inflateSync(bzz.subarray(o, o + bzs.readUInt32LE(n * 12 + 4))));
      }
      return cache.get(n);
    };
    return (i) => {
      const size = bzv.readUInt16LE(i * 10 + 8);
      if (!size) return '';
      const off = bzv.readUInt32LE(i * 10 + 4);
      return block(bzv.readUInt32LE(i * 10)).subarray(off, off + size).toString('utf8');
    };
  });
}

// Converts "Ro 5:8; 2Co 5:19-21; 1Jo 4:9,10; 15" into references, inheriting book and chapter from context.
function parse(text, book, chapter) {
  const out = [];
  let bk = book;
  let ch = chapter;
  const push = (c, v, end) => {
    if (c < 1 || c > shape[bk].length || v < 1 || v > shape[bk][c - 1]) return;
    const last = end && end > v ? Math.min(end, shape[bk][c - 1]) : 0;
    out.push(`${ids[bk]}.${c}.${v}${last ? `-${last}` : ''}`);
  };
  for (const token of text.split(';')) {
    const m = token.trim().match(/^(?:(\d?[A-Za-z]+)\s+)?(.+)$/);
    if (!m) continue;
    if (m[1]) {
      if (!(m[1] in byTsk)) continue;
      bk = byTsk[m[1]];
      ch = 1;
    }
    const wholeChapters = m[1] && !m[2].includes(':') && shape[bk].length > 1;
    for (const item of m[2].split(',')) {
      const x = item.trim().match(/^(?:(\d+):)?(\d+)(?:-(?:(\d+):)?(\d+))?$/);
      if (!x) continue;
      if (x[1]) ch = Number(x[1]);
      if (wholeChapters) {
        ch = Number(x[2]);
        push(ch, 1);
      } else {
        push(ch, Number(x[2]), x[3] && Number(x[3]) !== ch ? 0 : Number(x[4] ?? 0));
      }
    }
  }
  return out;
}

// Each segment of the verse ("my. ... I shall. ...") becomes a group; we take one reference per group
// per round, in TSK order, up to the limit.
function pick(raw, book, chapter) {
  const groups = [];
  for (const part of raw.split(/<br\s*\/?>/).map((p) => p.trim())) {
    const ref = part.match(/^<scripRef(?![^>]*passage)[^>]*>(.*?)<\/scripRef>$/);
    if (ref) {
      if (!groups.length) groups.push([]);
      groups[groups.length - 1].push(...parse(ref[1].replace(/<[^>]+>/g, ''), book, chapter));
    } else if (part.trim() && !/<scripRef/.test(part)) {
      groups.push([]);
    }
  }
  const seen = new Set();
  const out = [];
  for (let round = 0; out.length < LIMIT && groups.some((g) => g.length > round); round++) {
    for (const g of groups) {
      const r = g[round];
      if (!r || seen.has(r)) continue;
      seen.add(r);
      out.push(r);
      if (out.length === LIMIT) break;
    }
  }
  return out;
}

const dir = await mkdtemp(join(tmpdir(), 'tsk-'));
try {
  await writeFile(join(dir, 'TSK.zip'), Buffer.from(await (await get(TSK_URL)).arrayBuffer()));
  execFileSync('unzip', ['-q', '-o', join(dir, 'TSK.zip'), '-d', dir]);
  const outDir = new URL('../public/xrefs/', import.meta.url);
  await mkdir(outDir, { recursive: true });
  let verses = 0;
  let refs = 0;
  let bytes = 0;
  for (const [testament, from, to] of [['ot', 0, 39], ['nt', 39, 66]]) {
    const entry = await reader(dir, testament);
    let i = 2;
    for (let b = from; b < to; b++) {
      i++;
      const book = {};
      shape[b].forEach((n, c) => {
        i++;
        for (let v = 1; v <= n; v++, i++) {
          const list = pick(entry(i), b, c + 1).filter((r) => !r.startsWith(`${ids[b]}.${c + 1}.${v}`));
          if (!list.length) continue;
          book[`${c + 1}.${v}`] = list;
          verses++;
          refs += list.length;
        }
      });
      const json = JSON.stringify(book);
      bytes += json.length;
      await writeFile(new URL(`${fileOf(ids[b])}.json`, outDir), json + '\n');
    }
  }
  console.log(`${verses} verses, ${refs} references, ${(bytes / 1048576).toFixed(2)} MB in ${ids.length} files`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
