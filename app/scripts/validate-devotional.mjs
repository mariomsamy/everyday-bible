// Checks the verse list and the devotional packs. Run with: node scripts/validate-devotional.mjs
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const errors = [];
const fail = (msg) => errors.push(msg);

const BOOKS = ['gn', 'ex', 'lv', 'nm', 'dt', 'js', 'jz', 'rt', '1sm', '2sm', '1rs', '2rs', '1cr', '2cr', 'ed', 'ne', 'et', 'jó', 'sl', 'pv', 'ec', 'ct', 'is', 'jr', 'lm', 'ez', 'dn', 'os', 'jl', 'am', 'ob', 'jn', 'mq', 'na', 'hc', 'sf', 'ag', 'zc', 'ml', 'mt', 'mc', 'lc', 'jo', 'atos', 'rm', '1co', '2co', 'gl', 'ef', 'fp', 'cl', '1ts', '2ts', '1tm', '2tm', 'tt', 'fm', 'hb', 'tg', '1pe', '2pe', '1jo', '2jo', '3jo', 'jd', 'ap'];
const MOVEABLE = ['goodFriday', 'easter', 'pentecost'];
// 2024 is a leap year, so it lists February 29 too.
const calendar = [];
for (let m = 1; m <= 12; m++) for (let d = 1; d <= new Date(2024, m, 0).getDate(); d++) calendar.push(`${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

// Verse list
const votd = read('src/data/votd.json');
const ranges = new Map();
const checkRef = (key, r) => {
  if (!BOOKS.includes(r.book)) return fail(`votd ${key}: unknown book "${r.book}"`);
  if (!(r.chapter >= 1) || !(r.from >= 1) || (r.to !== undefined && !(r.to > r.from))) return fail(`votd ${key}: bad range`);
  const k = `${r.book}.${r.chapter}`;
  const [lo, hi] = [r.from, r.to ?? r.from];
  for (const [l, h, other] of ranges.get(k) ?? []) if (lo <= h && l <= hi) fail(`votd ${key} overlaps ${other}`);
  ranges.set(k, [...(ranges.get(k) ?? []), [lo, hi, key]]);
};
if (Object.keys(votd.days).join() !== calendar.join()) fail('votd: days are not exactly the 366 calendar days, in order');
for (const [k, r] of Object.entries(votd.days)) checkRef(k, r);
if (Object.keys(votd.moveable).join() !== MOVEABLE.join()) fail(`votd: moveable must be ${MOVEABLE.join(', ')}`);
for (const [k, r] of Object.entries(votd.moveable)) checkRef(k, r);

// Packs
const ENDING = { 'pt-BR': 'em nome de Jesus, Amém!', en: "in Jesus' name, Amen!" };
const files = readdirSync(new URL('../public/devotional/', import.meta.url)).filter((f) => f.endsWith('.json'));
const rows = [];
for (const f of files) {
  const lang = f.replace('.json', '');
  const pack = read(`public/devotional/${f}`);
  const here = (m) => `${lang} ${m}`;
  if (pack.lang !== lang) fail(here(`lang field is "${pack.lang}"`));
  if (!ENDING[lang]) fail(here('no prayer ending defined in the script'));
  if (Object.keys(pack.days).join() !== calendar.join()) fail(here('days are not exactly the 366 calendar days, in order'));
  if (Object.keys(pack.moveable).join() !== MOVEABLE.join()) fail(here('moveable keys are wrong'));
  const titles = new Map();
  for (const [k, e] of [...Object.entries(pack.days), ...Object.entries(pack.moveable)]) {
    const words = (s) => s.split(/\s+/).filter(Boolean).length;
    if (Object.keys(e).sort().join() !== 'paragraphs,prayer,title,today') fail(here(`${k}: wrong fields`));
    if (!Array.isArray(e.paragraphs) || e.paragraphs.length !== 3) fail(here(`${k}: needs 3 paragraphs`));
    const all = [e.title, ...(e.paragraphs ?? []), e.today, e.prayer].join(' ');
    if (/[—–()]/.test(all)) fail(here(`${k}: dash or parenthesis`));
    if (!e.prayer?.endsWith(ENDING[lang])) fail(here(`${k}: prayer must end with "${ENDING[lang]}"`));
    if (!e.title || words(e.title) > 7 || e.title.endsWith('.')) fail(here(`${k}: bad title`));
    if (titles.has(e.title)) fail(here(`${k}: title repeats ${titles.get(e.title)}`));
    titles.set(e.title, k);
    if (words([...(e.paragraphs ?? []), e.today, e.prayer].join(' ')) > 205) fail(here(`${k}: more than 200 words`));
  }
  const perMonth = Array.from({ length: 12 }, (_, i) => Object.keys(pack.days).filter((k) => k.startsWith(String(i + 1).padStart(2, '0'))).length);
  rows.push(`${lang}: ${Object.keys(pack.days).length} days + ${Object.keys(pack.moveable).length} moveable (months: ${perMonth.join(' ')})`);
}
if (!files.length) fail('no packs found in public/devotional');

console.log(`votd: ${Object.keys(votd.days).length} days + ${Object.keys(votd.moveable).length} moveable`);
rows.forEach((r) => console.log(r));
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ${errors.slice(0, 40).join('\n- ')}`);
  process.exit(1);
}
console.log('OK');
