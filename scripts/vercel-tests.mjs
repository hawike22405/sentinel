import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('Vercel imports Express without binding a socket or creating local SQLite files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-vercel-'));
  try {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "const { default: app } = await import('./server.js'); if (typeof app !== 'function') process.exit(2); console.log('imported');"], {
      env: { ...process.env, VERCEL: '1', TURSO_DATABASE_URL: 'https://fixture.invalid', TURSO_AUTH_TOKEN: 'test-only', SENTINEL_DATA_DIR: dir, FORCE_HTTPS: '0' },
      encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /imported/);
    assert.ok(!result.stdout.includes('listening'));
    assert.deepEqual(readdirSync(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Vercel refuses missing persistent storage rather than falling back to a temporary DB', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/store.js')"], {
    env: { ...process.env, VERCEL: '1', TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '' }, encoding: 'utf8', timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Vercel requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN/);
});
