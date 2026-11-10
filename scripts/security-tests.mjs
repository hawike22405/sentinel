// Security regression tests. Starts real server instances on random ports and probes them over HTTP.
// Run: npm test
import { spawn } from 'node:child_process';
import { mkdtempSync, statSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOKEN = 'test-admin-token-0123456789abcdef0123456789';
let failures = 0, passes = 0;
const check = (name, ok, extra = '') => { ok ? passes++ : failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`); };

let nextPort = 4300 + Math.floor(Math.random() * 400);
async function start(env = {}) {
  const port = nextPort++;
  const dataDir = mkdtempSync(join(tmpdir(), 'sentinel-test-'));
  const log = { out: '' };
  const child = spawn('node', ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), SENTINEL_DATA_DIR: dataDir, GENERAL_LIMIT: '1000', STRICT_LIMIT: '1000', ADMIN_TOKEN: '', FRONTEND_ORIGIN: '', FORCE_HTTPS: '', TRUST_PROXY: '', ...env } });
  child.stdout.on('data', (d) => (log.out += d));
  child.stderr.on('data', (d) => (log.out += d));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/api/health'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  return { base, log, dataDir, stop: async () => { child.kill('SIGTERM'); await new Promise((r) => setTimeout(r, 300)); rmSync(dataDir, { recursive: true, force: true }); } };
}
const post = (s, path, body, headers = { 'Content-Type': 'application/json' }) => fetch(s.base + path, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body), redirect: 'manual' });

// ---------- Main instance (admin enabled, generous limits) ----------
const s = await start({ ADMIN_TOKEN: TOKEN });

console.log('\n# 1/9 Authentication + admin routes');
let r = await fetch(s.base + '/api/admin/reports/00000000-0000-4000-8000-000000000000', { method: 'DELETE' });
check('admin route rejects missing token (401)', r.status === 401);
r = await fetch(s.base + '/api/admin/reports/00000000-0000-4000-8000-000000000000', { method: 'DELETE', headers: { Authorization: 'Bearer wrong' } });
check('admin route rejects wrong token (401)', r.status === 401);
r = await post(s, '/api/feed/report', { url: 'https://phish-test.example/a', type: 'phishing' });
const rep = await r.json();
r = await fetch(s.base + `/api/admin/reports/${rep.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
check('admin route accepts correct token and deletes report', r.status === 200);
r = await fetch(s.base + `/api/admin/reports/${rep.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
check('deleting a missing report returns 404', r.status === 404);
r = await fetch(s.base + '/api/admin/reports/not-a-uuid', { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
check('admin route validates id format (400)', r.status === 400);

console.log('\n# 3 Database');
if (process.platform !== 'win32') {
  const dirMode = statSync(s.dataDir).mode & 0o777;
  const files = readdirSync(s.dataDir).map((f) => statSync(join(s.dataDir, f)).mode & 0o077);
  check('data directory is not group/world accessible', (dirMode & 0o077) === 0, dirMode.toString(8));
  check('database files are owner-only', files.length > 0 && files.every((m) => m === 0), files.join(','));
}

console.log('\n# 6/16/18/20 Validation, content-type, body limits, debug off');
const bad = [
  ['missing url', {}], ['non-string url', { url: 123 }], ['ftp scheme', { url: 'ftp://example.com/' }],
  ['javascript scheme', { url: 'javascript:alert(1)' }], ['2KB+ url', { url: 'https://a.example/' + 'x'.repeat(2100) }],
  ['non-web port', { url: 'https://example.com:22/' }],
];
for (const [name, body] of bad) { r = await post(s, '/api/scan', body); check(`scan rejects ${name} (422)`, r.status === 422, String(r.status)); }
r = await post(s, '/api/feed/report', { url: 'https://x.example/', type: '<script>' });
check('report rejects unknown type (422)', r.status === 422);
r = await post(s, '/api/scan', '{bad');
const badJson = await r.text();
check('malformed JSON returns 400 without stack trace', r.status === 400 && !/\bat \w|node_modules|\.js:\d+/.test(badJson));
r = await post(s, '/api/scan', 'url=https://example.com', { 'Content-Type': 'application/x-www-form-urlencoded' });
check('form-encoded POST rejected (415) - CSRF', r.status === 415);
r = await post(s, '/api/scan', '{"url":"https://example.com"}', { 'Content-Type': 'text/plain' });
check('text/plain POST rejected (415) - CSRF', r.status === 415);
r = await post(s, '/api/feed/report', '--b\r\nContent-Disposition: form-data; name="f"; filename="a.txt"\r\n\r\nx\r\n--b--', { 'Content-Type': 'multipart/form-data; boundary=b' });
check('multipart upload rejected (415)', r.status === 415);
r = await post(s, '/api/scan', { url: 'https://example.com/', pad: 'a'.repeat(17000) });
check('oversized body rejected (413)', r.status === 413);
r = await fetch(s.base + '/api/scan/not-a-uuid');
check('scan id must be a UUID (400)', r.status === 400);
r = await fetch(s.base + '/nope');
const nf = await r.text();
check('404 is JSON with no internals', r.status === 404 && nf.includes('Not found'));

console.log('\n# 7/10 XSS + SQL injection');
r = await post(s, '/api/feed/report', { url: `https://x.example/<script>alert(1)</script>?q=' OR 1=1;--`, type: 'phishing' });
const x = await r.json();
check('sensitive URL path and query are not published', r.status === 201 && x.url === 'https://x.example/', x.url);
r = await post(s, '/api/feed/report', { url: `https://x.example/'); DROP TABLE reports;--`, type: 'phishing' });
r = await fetch(s.base + '/api/feed');
const feed = await r.json();
check('duplicate report rejected; SQL payload cannot damage tables', r.status === 200 && Array.isArray(feed.reports) && feed.reports.length === 1);
const csp = (await fetch(s.base + '/')).headers.get('content-security-policy') || '';
check("CSP forbids inline/eval scripts (no 'unsafe-inline'/'unsafe-eval')", /script-src 'self'/.test(csp) && !/unsafe-/.test(csp));

console.log('\n# 13/14/15 CORS, headers, cookies');
r = await fetch(s.base + '/api/feed', { headers: { Origin: 'https://evil.example' } });
check('no CORS header for foreign origin', !r.headers.get('access-control-allow-origin'));
r = await fetch(s.base + '/api/scan', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
check('preflight from foreign origin gets no CORS grant', !r.headers.get('access-control-allow-origin'));
r = await fetch(s.base + '/');
const h = (n) => r.headers.get(n);
check('security headers present', h('x-content-type-options') === 'nosniff' && h('x-frame-options') === 'DENY' && h('referrer-policy') === 'no-referrer' && h('cross-origin-opener-policy') === 'same-origin' && h('cross-origin-resource-policy') === 'same-origin' && !!h('permissions-policy'));
check('X-Powered-By removed', !h('x-powered-by'));
check('no Set-Cookie issued (no session surface)', !h('set-cookie'));
check('API responses are not cacheable', (await fetch(s.base + '/api/feed')).headers.get('cache-control') === 'no-store');

console.log('\n# 23 Exposed files');
for (const p of ['/server.js', '/package.json', '/package-lock.json', '/data/sentinel.db', '/src/store.js', '/src/detector.js', '/.git/config', '/.env', '/.env.example', '/GATES.md', '/README.md', '/scripts/verify-all.mjs', '/node_modules/express/package.json', '/assets/../server.js', '/%2e%2e/server.js', '/assets/%2e%2e/server.js', '/assets/..%2fserver.js']) {
  r = await fetch(s.base + p);
  const body = await r.text();
  check(`not exposed: ${p}`, r.status !== 200 || body.includes('<html') === false && !body.includes('express'), String(r.status));
}
const idx = await (await fetch(s.base + '/')).text();
check('frontend still served (React app with root div)', (await fetch(s.base + '/')).status === 200 && idx.includes('id="root"'));

console.log('\n# 26 SSRF / abuse of the scanner');
for (const u of ['http://localhost/', 'http://127.0.0.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.1/', 'http://192.168.1.1/', 'http://172.16.0.1/', 'http://2130706433/', 'http://0x7f.1/', 'http://foo.localhost/', 'http://localhost./', 'http://[64:ff9b::a00:1]/', 'http://[2002:7f00:1::]/', 'http://192.0.2.1/']) {
  r = await post(s, '/api/scan', { url: u });
  check(`scan blocks ${u}`, r.status === 422, String(r.status));
}

console.log('\n# 8 Suspicious activity is logged');
check('ssrf_blocked logged', s.log.out.includes('"event":"ssrf_blocked"'));
check('admin_auth_failed logged', s.log.out.includes('"event":"admin_auth_failed"'));
check('bad_content_type logged', s.log.out.includes('"event":"bad_content_type"'));
check('invalid_url logged', s.log.out.includes('"event":"invalid_url"'));
check('log lines are valid JSON and contain no token', s.log.out.split('\n').filter((l) => l.startsWith('{')).every((l) => { try { JSON.parse(l); return true; } catch { return false; } }) && !s.log.out.includes(TOKEN));
await s.stop();

// ---------- Admin disabled without token ----------
console.log('\n# 11 Environment configuration');
let s2 = await start();
r = await fetch(s2.base + '/api/admin/reports/00000000-0000-4000-8000-000000000000', { method: 'DELETE', headers: { Authorization: 'Bearer anything' } });
check('admin endpoint does not exist when ADMIN_TOKEN is unset (404)', r.status === 404);
await s2.stop();
s2 = await start({ ADMIN_TOKEN: 'short' });
r = await fetch(s2.base + '/api/admin/reports/00000000-0000-4000-8000-000000000000', { method: 'DELETE', headers: { Authorization: 'Bearer short' } });
check('weak (<32 char) ADMIN_TOKEN is refused and admin stays disabled', r.status === 404);
await s2.stop();

// ---------- HTTPS enforcement ----------
console.log('\n# 4 HTTPS');
s2 = await start({ FORCE_HTTPS: '1', PUBLIC_HOST: 'sentinel.example', TRUST_PROXY: '1' });
r = await fetch(s2.base + '/api/feed?x=1', { redirect: 'manual' });
check('plain HTTP is redirected (308) to https://PUBLIC_HOST', r.status === 308 && r.headers.get('location') === 'https://sentinel.example/api/feed?x=1', `${r.status} ${r.headers.get('location')}`);
r = await fetch(s2.base + '/', { redirect: 'manual', headers: { Host: 'evil.example' } });
check('redirect target ignores a spoofed Host header', (r.headers.get('location') || '').startsWith('https://sentinel.example'));
r = await fetch(s2.base + '/', { headers: { 'X-Forwarded-Proto': 'https' } });
check('HTTPS (via proxy) is served with HSTS', r.status === 200 && /max-age=\d+/.test(r.headers.get('strict-transport-security') || ''));
await s2.stop();
s2 = await start();
check('HSTS not sent over plain HTTP in dev', !(await fetch(s2.base + '/')).headers.get('strict-transport-security'));
await s2.stop();

// ---------- Rate limiting (default limits) ----------
console.log('\n# 12 Rate limiting');
s2 = await start({ STRICT_LIMIT: '5', GENERAL_LIMIT: '1000' });
const codes = [];
for (let i = 0; i < 8; i++) codes.push((await post(s2, '/api/feed/report', { url: `https://rl-${i}.example/`, type: 'scam' })).status);
check('strict limiter returns 429 after the limit', codes.includes(429) && codes.slice(0, 5).every((c) => c === 201), codes.join(','));
check('rate_limited event logged', s2.log.out.includes('"event":"rate_limited"'));
await s2.stop();

console.log(`\n${failures ? 'SECURITY TESTS FAILED' : 'security tests passed'}: ${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
