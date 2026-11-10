import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('legacy migration, retention, deduplication and scan persistence protect URL secrets', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-store-'));
  process.env.SENTINEL_DATA_DIR = dir;
  const file = join(dir, 'sentinel.db');
  const seed = new Database(file);
  seed.exec(`CREATE TABLE scans (id TEXT PRIMARY KEY, url TEXT NOT NULL, score INTEGER NOT NULL, verdict TEXT NOT NULL, created_at TEXT NOT NULL, details TEXT);
    CREATE TABLE reports (id TEXT PRIMARY KEY, url TEXT NOT NULL, type TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL);`);
  const now = new Date().toISOString();
  const insert = seed.prepare('INSERT INTO scans VALUES (?, ?, 0, ?, ?, ?)');
  seed.transaction(() => {
    for (let i = 0; i < 10002; i++) insert.run(String(i), 'https://example.com/secret-path?token=secret-query#secret-fragment', 'safe', now, '{}');
    insert.run('expired', 'https://expired.example/', 'safe', '2000-01-01 00:00:00', '{}');
  })();
  seed.prepare('INSERT INTO reports VALUES (?, ?, ?, ?, ?)').run('first', 'https://example.com/private?key=secret-query', 'phishing', 'user-report', now);
  seed.prepare('INSERT INTO reports VALUES (?, ?, ?, ?, ?)').run('second', 'https://example.com/another', 'phishing', 'user-report', now);
  seed.close();
  let store;
  try {
    store = await import('../src/store.js');
    const read = new Database(file, { readonly: true });
    assert.equal(read.prepare('SELECT COUNT(*) n FROM scans').get().n, 10000);
    assert.equal(read.prepare("SELECT COUNT(*) n FROM scans WHERE id = 'expired'").get().n, 0);
    assert.equal(read.prepare("SELECT COUNT(*) n FROM scans WHERE url != 'https://example.com/'").get().n, 0);
    assert.equal(store.listReports().length, 1);
    assert.equal(store.countReportsForHost('example.com'), 1);
    assert.equal(store.createReport({ id: 'duplicate', url: 'https://example.com/?password=secret', type: 'phishing', source: 'user-report' }), false);
    store.createScan({ id: 'new', url: 'https://new.example/private?key=secret#fragment', score: 0, verdict: 'unknown', details: { checks: { certificate: { completed: false } }, assessment: 'incomplete', scoreVersion: 'heuristic-v2' } });
    assert.equal(store.getScanById('new').url, 'https://new.example/');
    assert.equal(store.getScanById('new').checks.certificate.completed, false);
    assert.equal(read.prepare('SELECT COUNT(*) n FROM scans').get().n, 10000);
    read.close();
    store.closeStore(); store = null;
    const bytes = readFileSync(file);
    for (const secret of ['secret-path', 'secret-query', 'secret-fragment']) assert.equal(bytes.includes(Buffer.from(secret)), false, secret);
  } finally {
    store?.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});
