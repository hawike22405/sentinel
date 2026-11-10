import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createLibsqlStore } from '../src/libsql-store.js';

test('hosted SQL contract preserves origins, deduplication, retention and results', async () => {
  const db = new Database(':memory:');
  const execute = statement => {
    const { sql, args = [] } = typeof statement === 'string' ? { sql: statement } : statement;
    const stmt = db.prepare(sql);
    if (stmt.reader) return { rows: stmt.all(...args), rowsAffected: 0 };
    return { rows: [], rowsAffected: stmt.run(...args).changes };
  };
  const client = { execute: async statement => execute(statement),
    batch: async statements => db.transaction(() => statements.map(execute))(), close: () => db.close() };
  const store = createLibsqlStore(client);
  try {
    const details = { scoreVersion: 'heuristic-v2', assessment: 'incomplete', checks: { headers: { completed: false } } };
    await store.createScan({ id: 'test-scan', url: 'https://example.com/private?secret=token#fragment', score: 0, verdict: 'unknown', details });
    const record = await store.getScanById('test-scan');
    assert.equal(record.url, 'https://example.com/');
    assert.equal(record.scoreVersion, details.scoreVersion);
    assert.deepEqual(record.checks, details.checks);
    const report = { id: 'r1', url: 'https://example.com/private?secret=token', type: 'phishing', source: 'user-report' };
    assert.equal(await store.createReport(report), true);
    assert.equal(await store.createReport({ ...report, id: 'r2' }), false);
    assert.equal(await store.countReportsForHost('example.com'), 1);
    assert.equal((await store.listReports())[0].url, 'https://example.com/');
    db.prepare("UPDATE reports SET created_at = '2000-01-01T00:00:00.000Z'").run();
    assert.equal(await store.countReportsForHost('example.com'), 0);
    assert.equal((await store.listReports()).length, 0);
    assert.equal(await store.createReport({ ...report, id: 'r3' }), true);
    assert.equal(await store.deleteReport('r3'), true);
    assert.equal(await store.deleteReport('r3'), false);
    db.prepare("UPDATE scans SET created_at = '2000-01-01T00:00:00.000Z'").run();
    assert.equal(await store.getScanById('test-scan'), null);
    const add = db.prepare('INSERT INTO scans VALUES (?, ?, 0, ?, ?, ?)');
    db.transaction(() => { for (let i = 0; i < 10002; i++) add.run(String(i), 'https://example.com/', 'unknown', new Date().toISOString(), '{}'); })();
    await store.pruneStore();
    assert.equal(db.prepare('SELECT COUNT(*) n FROM scans').get().n, 10000);
  } finally { store.closeStore(); }
});
