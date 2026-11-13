import { DatabaseSync } from 'node:sqlite';

const DAY = 86_400_000;
export const RETENTION_DAYS = 400; // ~13 months, as promised in the privacy policy

export function openDb(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA secure_delete = ON;
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      ts INTEGER NOT NULL,
      day TEXT NOT NULL,
      did TEXT NOT NULL,
      name TEXT NOT NULL,
      props TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS events_day_name ON events (day, name);
    CREATE INDEX IF NOT EXISTS events_did ON events (did);
    CREATE TABLE IF NOT EXISTS devices (
      did TEXT PRIMARY KEY,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      chapters INTEGER NOT NULL DEFAULT 0,
      pct REAL NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      plan_days INTEGER NOT NULL DEFAULT 0,
      pace TEXT NOT NULL DEFAULT 'none'
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ai_usage (day TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, refused INTEGER NOT NULL DEFAULT 0);
  `);
  return db;
}

const dayOf = (ts) => new Date(ts).toISOString().slice(0, 10);

export function recordEvents(db, did, events, now = Date.now()) {
  const ins = db.prepare('INSERT INTO events (ts, day, did, name, props) VALUES (?, ?, ?, ?, ?)');
  const touch = db.prepare(`INSERT INTO devices (did, first_seen, last_seen) VALUES (?, ?, ?)
    ON CONFLICT(did) DO UPDATE SET last_seen = excluded.last_seen`);
  const snap = db.prepare('UPDATE devices SET chapters = ?, pct = ?, streak = ?, plan_days = ?, pace = ? WHERE did = ?');
  db.exec('BEGIN');
  try {
    touch.run(did, now, now);
    for (const e of events) {
      ins.run(e.ts, dayOf(e.ts), did, e.name, JSON.stringify(e.props));
      if (e.name === 'progress') {
        const p = e.props;
        const n = (v, max) => (typeof v === 'number' ? Math.min(max, Math.max(0, v)) : 0);
        snap.run(n(p.read, 5000), n(p.pct, 100), n(p.streak, 100000), n(p.plan_days, 3650), typeof p.pace === 'string' ? p.pace : 'none', did);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function forget(db, did) {
  db.prepare('DELETE FROM events WHERE did = ?').run(did);
  db.prepare('DELETE FROM devices WHERE did = ?').run(did);
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); // do not leave the deleted rows in the WAL file
}

export function purge(db, now = Date.now(), days = RETENTION_DAYS) {
  const cut = now - Math.min(days, RETENTION_DAYS) * DAY;
  db.prepare('DELETE FROM events WHERE ts < ?').run(cut);
  db.prepare('DELETE FROM devices WHERE last_seen < ?').run(cut);
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
}

const rows = (db, sql, ...args) => db.prepare(sql).all(...args);
const jget = (props, k) => { try { return JSON.parse(props)[k]; } catch { return undefined; } };

const statsCache = new WeakMap();
/** Cached for 60 s: the queries scan a month of events and run on the event loop. */
export function stats(db, now = Date.now()) {
  const c = statsCache.get(db);
  if (c && now - c.at < 60_000) return c.value;
  const value = computeStats(db, now);
  statsCache.set(db, { at: now, value });
  return value;
}

function computeStats(db, now) {
  const today = dayOf(now);
  const since = (n) => dayOf(now - (n - 1) * DAY);
  const d30 = since(30);
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const active = (n) => one('SELECT COUNT(DISTINCT did) c FROM events WHERE day >= ?', since(n)).c;

  const dau = rows(db, 'SELECT day, COUNT(DISTINCT did) users, COUNT(*) events FROM events WHERE day >= ? GROUP BY day ORDER BY day', d30);
  const chaptersPerDay = rows(db, "SELECT day, COUNT(*) n FROM events WHERE name = 'chapter_read' AND day >= ? GROUP BY day ORDER BY day", d30);
  const byName = rows(db, 'SELECT name, COUNT(*) n, COUNT(DISTINCT did) users FROM events WHERE day >= ? GROUP BY name ORDER BY n DESC', d30);

  const countBy = (name, key) => {
    const m = new Map();
    for (const r of rows(db, 'SELECT props FROM events WHERE name = ? AND day >= ?', name, d30)) {
      const v = jget(r.props, key);
      if (v !== undefined) m.set(String(v), (m.get(String(v)) ?? 0) + 1);
    }
    return [...m].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
  };

  const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const r of rows(db, 'SELECT pct FROM devices')) buckets[Math.min(9, Math.floor(r.pct / 10))]++;
  const dev = one('SELECT COUNT(*) devices, COALESCE(AVG(chapters),0) avg_chapters, COALESCE(AVG(pct),0) avg_pct, COALESCE(AVG(streak),0) avg_streak, COALESCE(MAX(streak),0) max_streak FROM devices');
  const withPlan = one('SELECT COUNT(*) c FROM devices WHERE plan_days > 0').c;
  const planDays = rows(db, `SELECT CASE WHEN plan_days <= 30 THEN '≤30' WHEN plan_days <= 90 THEN '31–90' WHEN plan_days <= 180 THEN '91–180' WHEN plan_days <= 365 THEN '181–365' ELSE '>365' END k, COUNT(*) n
    FROM devices WHERE plan_days > 0 GROUP BY k`);
  const pace = rows(db, "SELECT pace k, COUNT(*) n FROM devices WHERE pace != 'none' GROUP BY pace ORDER BY n DESC");

  return {
    generatedAt: new Date(now).toISOString(),
    today,
    users: { total: dev.devices, active1: active(1), active7: active(7), active30: active(30), newLast30: one('SELECT COUNT(*) c FROM devices WHERE first_seen >= ?', now - 30 * DAY).c },
    progress: { avgChapters: dev.avg_chapters, avgPct: dev.avg_pct, avgStreak: dev.avg_streak, maxStreak: dev.max_streak, histogram: buckets, withPlan, pace, planDays },
    dau, chaptersPerDay, events: byName,
    topBooks: countBy('chapter_read', 'book').slice(0, 15),
    shares: countBy('share', 'channel'),
    versions: countBy('version_use', 'version'),
    screens: countBy('screen_view', 'screen_name'),
    features: countBy('feature_use', 'feature'),
    installs: one("SELECT COUNT(*) c FROM events WHERE name = 'app_install'").c,
  };
}

/** Counts one AI request for today. Returns the new total, so the caller can enforce the global daily cap. */
export function bumpAiUsage(db, now = Date.now()) {
  const day = dayOf(now);
  db.prepare('INSERT INTO ai_usage (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1').run(day);
  return db.prepare('SELECT n FROM ai_usage WHERE day = ?').get(day).n;
}
export function refuseAiUsage(db, now = Date.now()) {
  db.prepare('INSERT INTO ai_usage (day, n, refused) VALUES (?, 0, 1) ON CONFLICT(day) DO UPDATE SET refused = refused + 1').run(dayOf(now));
}
export const aiUsage = (db, days = 30, now = Date.now()) => db.prepare('SELECT day, n, refused FROM ai_usage WHERE day >= ? ORDER BY day').all(dayOf(now - (days - 1) * DAY));

/** Deletes every analytics row (events and device snapshots). Settings are kept. */
export function purgeAll(db) {
  db.exec('DELETE FROM events; DELETE FROM devices;');
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
}
