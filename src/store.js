import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 3. Database lives outside the web root, owner-only (dir 0700, files 0600; umask covers WAL/SHM files).
const DATA_DIR = process.env.SENTINEL_DATA_DIR || join(fileURLToPath(new URL('..', import.meta.url)), 'data');
process.umask(0o077);
mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
try { chmodSync(DATA_DIR, 0o700); } catch { /* unsupported on some platforms */ }

const db = new Database(join(DATA_DIR, 'sentinel.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
try { chmodSync(join(DATA_DIR, 'sentinel.db'), 0o600); } catch { /* unsupported on some platforms */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    score INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    details TEXT
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_reports_url ON reports(url);
  CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
`);

// Migration: reports.host lets the detector look up community reports per site.
if (!db.prepare('PRAGMA table_info(reports)').all().some((c) => c.name === 'host')) {
  db.exec('ALTER TABLE reports ADD COLUMN host TEXT');
  const fill = db.prepare('UPDATE reports SET host = ? WHERE id = ?');
  for (const r of db.prepare('SELECT id, url FROM reports').all()) {
    try { fill.run(new URL(r.url).hostname, r.id); } catch { /* leave null */ }
  }
}
db.exec('CREATE INDEX IF NOT EXISTS idx_reports_host ON reports(host)');

// Old rows hold SQLite "YYYY-MM-DD HH:MM:SS" (UTC, no zone); normalise to ISO 8601.
const isoTs = (v) => (v && !v.includes('T') ? v.replace(' ', 'T') + 'Z' : v);

const insertScan = db.prepare(
  'INSERT INTO scans (id, url, score, verdict, details, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const getScan = db.prepare('SELECT * FROM scans WHERE id = ?');
const insertReport = db.prepare(
  'INSERT INTO reports (id, url, host, type, source, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const removeReport = db.prepare('DELETE FROM reports WHERE id = ?');
const countByHost = db.prepare('SELECT COUNT(*) AS n FROM reports WHERE host = ?');
const getReports = db.prepare(
  'SELECT * FROM reports ORDER BY created_at DESC LIMIT ?'
);

export function createScan({ id, url, score, verdict, details }) {
  insertScan.run(id, url, score, verdict, JSON.stringify(details), new Date().toISOString());
}

export function getScanById(id) {
  const row = getScan.get(id);
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    score: row.score,
    verdict: row.verdict,
    created_at: isoTs(row.created_at),
    details: JSON.parse(row.details || '{}'),
  };
}

export function createReport({ id, url, type, source }) {
  let host = null;
  try { host = new URL(url).hostname; } catch { /* keep null */ }
  insertReport.run(id, url, host, type, source, new Date().toISOString());
}

export function deleteReport(id) {
  return removeReport.run(id).changes > 0;
}

export function countReportsForHost(host) {
  return countByHost.get(host).n;
}

export function listReports(limit = 50) {
  return getReports.all(limit).map((r) => ({ ...r, created_at: isoTs(r.created_at) }));
}

export function closeStore() {
  db.close();
}
