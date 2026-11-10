import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isPrivateIp, validateUrl, buildResult, assessHeaders, fetchHeaders, validateCertificate, REQUEST_TIMEOUT_MS, pinnedLookup } from '../src/detector.js';

const okHeaders = { status: 'ok', completed: true, checks: [] };
const okCert = { status: 'ok', completed: true };

test('missing network evidence never produces a safe verdict', () => {
  const url = new URL('https://example.com/');
  for (const [headers, cert] of [[{ completed: false }, okCert], [okHeaders, { completed: false }]]) {
    assert.equal(buildResult(url, headers, cert).verdict, 'unknown');
  }
  assert.equal(buildResult(url, okHeaders, okCert).assessment, 'limited');
});

test('anonymous report poisoning cannot change score or verdict', () => {
  const url = new URL('https://example.com/');
  const clean = buildResult(url, okHeaders, okCert);
  const poisoned = buildResult(url, okHeaders, okCert, 10000);
  assert.equal(poisoned.score, clean.score);
  assert.equal(poisoned.verdict, clean.verdict);
  assert.equal(poisoned.checks.threat.verified, false);
});

test('encoded, mapped, tunnel, reserved and trailing-dot local targets fail closed', () => {
  for (const url of ['http://2130706433/', 'http://0x7f.1/', 'http://localhost./', 'http://a.local./',
    'http://[::ffff:7f00:1]/', 'http://[64:ff9b::7f00:1]/', 'http://[2002:7f00:1::]/',
    'http://[2001:db8::1]/', 'http://[3fff::1]/', 'http://198.51.100.1/', 'http://224.1.1.1/']) {
    assert.equal(validateUrl(url).ok, false, url);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '2001:4860:4860::8888']) assert.equal(isPrivateIp(ip), false, ip);
  assert.equal(validateUrl('https://user:secret@example.com/').ok, false);
});

test('pinning supports Node single-address and all-address lookup contracts', () => {
  const target = { address: '8.8.8.8', family: 4 };
  pinnedLookup(target)('ignored', {}, (err, address, family) => { assert.equal(err, null); assert.equal(address, target.address); assert.equal(family, 4); });
  pinnedLookup(target)('ignored', { all: true }, (err, addresses) => { assert.equal(err, null); assert.deepEqual(addresses, [target]); });
});

test('HTTP inspections use the pinned address, do not follow redirects or consume bodies', async () => {
  let requests = 0;
  const server = http.createServer((_req, res) => { requests++; res.writeHead(302, { Location: 'http://127.0.0.1/private' }); res.flushHeaders(); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const response = await fetchHeaders(new URL(`http://fixture.example:${server.address().port}/`), { address: '127.0.0.1', family: 4 });
    const result = assessHeaders(response);
    assert.equal(requests, 1);
    assert.equal(result.completed, false);
    assert.match(result.detail, /Redirect destination was not scanned/);
    assert.equal(buildResult(new URL('https://fixture.example/'), result, okCert).verdict, 'unknown');
    assert.equal(assessHeaders({ statusCode: 403, headers: {} }).completed, false);
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
});

test('HTTP deadline bounds slow-drip headers rather than resetting on traffic', async () => {
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.write('HTTP/1.1 200 OK\r\nX-Slow: ');
    const interval = setInterval(() => socket.write('a'), 100);
    socket.on('close', () => { clearInterval(interval); sockets.delete(socket); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const started = Date.now();
  try {
    await assert.rejects(fetchHeaders(new URL(`http://fixture.example:${server.address().port}/`), { address: '127.0.0.1', family: 4 }), /deadline/);
    assert.ok(Date.now() - started < REQUEST_TIMEOUT_MS + 1500);
  } finally { for (const socket of sockets) socket.destroy(); await new Promise(r => server.close(r)); }
});

test('TLS inspects the requested port and rejects wrong-host, untrusted certificates; HTTP skips TLS', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sentinel-cert-'));
  let server;
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem'), '-days', '2', '-subj', '/CN=wrong.example', '-addext', 'subjectAltName=DNS:wrong.example'], { stdio: 'ignore' });
    server = tls.createServer({ key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) });
    server.on('tlsClientError', () => {});
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const result = await validateCertificate(new URL(`https://fixture.example:${server.address().port}/`), { address: '127.0.0.1', family: 4 });
    assert.equal(result.completed, true);
    assert.equal(result.status, 'bad');
    assert.match(result.detail, /does not match/);
    assert.match(result.detail, /not trusted/);
    assert.equal(result.info.transparencyLog, 'Not checked');
    const skipped = await validateCertificate(new URL('http://fixture.example/'), {});
    assert.equal(skipped.completed, false);
    assert.match(skipped.detail, /unencrypted HTTP/);
  } finally { if (server) await new Promise(r => server.close(r)); rmSync(dir, { recursive: true, force: true }); }
});

test('GitHub-style .git and HTTP-to-HTTPS redirects reach and assess the final endpoint', async () => {
  const { requestTarget } = await import('../src/detector.js');
  const calls = [], resolved = [];
  const observed = await requestTarget('http://github.com/owner/project.git', {
    resolve: async host => { resolved.push(host); return { address: '8.8.8.8', family: 4 }; },
    fetch: async (url, target) => {
      calls.push(url.href);
      assert.equal(target.address, '8.8.8.8');
      return calls.length === 1 ? { statusCode: 301, headers: { location: 'https://github.com/owner/project.git' } }
        : calls.length === 2 ? { statusCode: 302, headers: { location: '/owner/project' } }
        : { statusCode: 200, headers: { 'strict-transport-security': 'max-age=31536000' } };
    },
  });
  assert.equal(observed.url.href, 'https://github.com/owner/project');
  assert.equal(assessHeaders(observed.response).completed, true);
  assert.equal(observed.redirects.length, 2);
  assert.equal(resolved.length, 3);
  assert.deepEqual(Object.keys(observed.redirects[0]).sort(), ['from', 'statusCode', 'to']);
});

test('redirects cannot escape to private addresses, unsafe schemes, credentials or downgrade HTTPS', async () => {
  const { requestTarget } = await import('../src/detector.js');
  for (const location of ['http://127.0.0.1/private', 'https://[::1]/', 'https://169.254.169.254/', 'https://localhost./',
    'file:///etc/passwd', 'https://user:password@github.com/', 'http://github.com/']) {
    let requests = 0;
    await assert.rejects(requestTarget('https://github.com/start', {
      resolve: async () => ({ address: '8.8.8.8', family: 4 }),
      fetch: async () => { requests++; return { statusCode: 302, headers: { location } }; },
    }), err => err.code === 'REDIRECT_BLOCKED', location);
    assert.equal(requests, 1, 'must not contact blocked destination');
  }
});

test('redirect DNS is revalidated and loops/long chains are bounded', async () => {
  const { requestTarget } = await import('../src/detector.js');
  let requests = 0;
  await assert.rejects(requestTarget('https://github.com/', {
    resolve: async host => {
      if (host !== 'github.com') throw Object.assign(new Error('private DNS result'), { code: 'PRIVATE_TARGET' });
      return { address: '8.8.8.8', family: 4 };
    },
    fetch: async () => { requests++; return { statusCode: 302, headers: { location: 'https://rebinding.example/' } }; },
  }), err => err.code === 'PRIVATE_TARGET');
  assert.equal(requests, 1);
  for (const loop of [true, false]) {
    let count = 0;
    await assert.rejects(requestTarget('https://github.com/start', {
      resolve: async () => ({ address: '8.8.8.8', family: 4 }),
      fetch: async () => ({ statusCode: 302, headers: { location: loop ? '/start' : '/hop-' + count++ } }),
    }), err => err.code === (loop ? 'REDIRECT_LOOP' : 'REDIRECT_LIMIT'));
  }
});

test('connection errors explain scanner failures without claiming HTTPS is absent or leaking raw errors', async () => {
  const { connectionFailure } = await import('../src/detector.js');
  for (const [stage, code, expected] of [['dns', 'ECONNREFUSED', 'DNS_UNAVAILABLE'], ['http', 'ECONNREFUSED', 'CONNECTION_REFUSED'],
    ['tls', 'ECONNRESET', 'CONNECTION_RESET'], ['tls', 'ENETUNREACH', 'NETWORK_UNREACHABLE'], ['http', 'ETIMEDOUT', 'CONNECTION_TIMEOUT']]) {
    const check = connectionFailure(stage, { code, message: 'secret-proxy-password' });
    assert.equal(check.errorCode, expected);
    assert.equal(check.completed, false);
    assert.ok(!JSON.stringify(check).includes('secret-proxy-password'));
    assert.match(check.detail, /incomplete scan/);
  }
});

test('an aborted HTTP request releases its socket promptly', async () => {
  const sockets = new Set();
  const server = net.createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const controller = new AbortController();
    const request = fetchHeaders(new URL(`http://fixture.example:${server.address().port}/`), { address: '127.0.0.1', family: 4 }, { signal: controller.signal });
    controller.abort();
    await assert.rejects(request, err => err.code === 'ABORT_ERR');
  } finally { for (const socket of sockets) socket.destroy(); await new Promise(r => server.close(r)); }
});

test('redirect orchestration works against a real local HTTP fixture', async () => {
  const { requestTarget } = await import('../src/detector.js');
  const paths = [];
  const server = http.createServer((req, res) => {
    paths.push(req.url);
    if (req.url === '/project.git') res.writeHead(302, { location: '/project' });
    else res.writeHead(200, { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' });
    res.end();
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const observed = await requestTarget('http://fixture.example:8080/project.git', {
      resolve: async () => ({ address: '127.0.0.1', family: 4 }),
      fetch: (url, target, options) => {
        const fixtureUrl = new URL(url); fixtureUrl.port = String(server.address().port);
        return fetchHeaders(fixtureUrl, target, options);
      },
    });
    assert.deepEqual(paths, ['/project.git', '/project']);
    assert.equal(assessHeaders(observed.response).completed, true);
    assert.equal(observed.url.pathname, '/project');
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
});

test('HTTP redirects to HTTPS require completed TLS evidence at the final destination', () => {
  const result = buildResult(new URL('http://github.com/'), okHeaders, { status: 'warn', completed: false }, 0, new URL('https://github.com/'));
  assert.equal(result.verdict, 'unknown');
  assert.equal(result.assessment, 'incomplete');
});
