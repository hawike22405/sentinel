import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function start(port) {
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-startup-'));
  const child = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(port), SENTINEL_DATA_DIR: dir, FORCE_HTTPS: '0', ADMIN_TOKEN: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => stdout += d);
  child.stderr.on('data', d => stderr += d);
  const exited = once(child, 'exit');
  return { child, dir, exited, logs: () => ({ stdout, stderr }) };
}
async function cleanup(s) {
  if (s.child.exitCode === null) { s.child.kill('SIGTERM'); await s.exited; }
  rmSync(s.dir, { recursive: true, force: true });
}

test('occupied port reports an actionable bind error without a null-address crash', { timeout: 10000 }, async () => {
  const occupied = http.createServer((_req, res) => res.end('Existing server'));
  occupied.listen(0); await once(occupied, 'listening');
  const port = occupied.address().port;
  const s = start(port);
  try {
    const [code] = await s.exited;
    assert.equal(code, 1);
    const { stdout, stderr } = s.logs();
    assert.match(stderr, /already in use/);
    assert.match(stderr, /PORT=3001/);
    assert.ok(!stderr.includes('TypeError'));
    assert.ok(!stdout.includes('backend listening'));
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(), 'Existing server');
  } finally { await cleanup(s); await new Promise(r => occupied.close(r)); }
});

test('fresh backend health and scan responses match the current frontend contract', { timeout: 20000 }, async () => {
  const s = start(0);
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Startup deadline exceeded')), 5000);
      s.child.stdout.on('data', d => {
        const match = String(d).match(/localhost:(\d+)/);
        if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
      });
      s.exited.then(() => { clearTimeout(timer); reject(new Error('Server exited: ' + s.logs().stderr)); });
    });
    const health = await (await fetch(base + '/api/health')).json();
    assert.equal(health.scannerVersion, 'heuristic-v2-redirects');
    const response = await fetch(base + '/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://sentinel-nonexistent.invalid/' }) });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(result.scoreVersion);
    assert.ok(result.checks);
    assert.equal(result.assessment, 'incomplete');
    assert.equal(result.verdict, 'unknown');
    assert.equal((await fetch(base + '/')).headers.get('cache-control'), 'no-cache');
  } finally { await cleanup(s); }
});
