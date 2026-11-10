// Local admission/overload regression, NOT a production throughput benchmark.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
const dir = mkdtempSync(join(tmpdir(), 'sentinel-capacity-'));
const child = spawn(process.execPath, ['--import', './scripts/fixtures/slow-dns.mjs', 'server.js'], {
  env: { ...process.env, PORT: '0', SENTINEL_DATA_DIR: dir, GENERAL_LIMIT: '1000', STRICT_LIMIT: '1000', FORCE_HTTPS: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
child.stderr.on('data', chunk => log += chunk);
try {
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Startup deadline exceeded: ' + log)), 10000);
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Server exited: ' + log)); });
    child.stdout.on('data', chunk => {
      const match = String(chunk).match(/localhost:(\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
  });
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.scannerVersion, 'heuristic-v2-redirects');
  const started = performance.now();
  const scans = Promise.all(Array.from({ length: 20 }, async (_, i) => {
    const res = await fetch(base + '/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: `https://fixture-${i}.example/private?token=do-not-store` }) });
    return { status: res.status, retry: res.headers.get('retry-after'), body: await res.json() };
  }));
  const healthTimes = await Promise.all(Array.from({ length: 100 }, async () => {
    const start = performance.now();
    assert.equal((await fetch(base + '/api/health')).status, 200);
    return performance.now() - start;
  }));
  const results = await scans;
  assert.equal(results.filter(r => r.status === 200).length, 10);
  assert.equal(results.filter(r => r.status === 503 && r.retry === '5').length, 10);
  for (const r of results.filter(r => r.status === 200)) {
    assert.equal(r.body.verdict, 'unknown');
    assert.ok(!r.body.url.includes('token'));
    const saved = await (await fetch(base + '/api/scan/' + r.body.id)).json();
    assert.deepEqual(saved.checks, r.body.checks);
    assert.equal(saved.scoreVersion, r.body.scoreVersion);
  }
  assert.equal((await fetch(base + '/api/health')).status, 200);
  healthTimes.sort((a, b) => a - b);
  console.log(JSON.stringify({ test: 'local-overload-fixture', requests: 120, admittedScans: 10, busy503: 10,
    health200: 100, healthP95Ms: Math.round(healthTimes[94]), totalMs: Math.round(performance.now() - started),
    note: '2-second DNS fixture; not production network throughput' }, null, 2));
} finally {
  child.kill('SIGTERM');
  if (child.exitCode === null) await once(child, 'exit');
  rmSync(dir, { recursive: true, force: true });
}
