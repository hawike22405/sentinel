import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 31972;
let serverProc;

function startServer() {
  return new Promise((resolve, reject) => {
    serverProc = spawn('node', ['server.js'], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let ready = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes(`listening on http://localhost:${PORT}`)) {
        ready = true;
        resolve();
      }
    };
    serverProc.stdout.on('data', onData);
    serverProc.stderr.on('data', onData);
    serverProc.on('error', (err) => {
      if (!ready) reject(err);
    });
    setTimeout(() => {
      if (!ready) reject(new Error('Server did not become ready in time'));
    }, 15000);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverProc) serverProc.kill('SIGTERM');
    resolve();
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 16000,
      },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => resolve({ status: res.statusCode, body: out }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${PORT}${path}`, (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => resolve({ status: res.statusCode, body: out }));
      })
      .on('error', reject)
      .setTimeout(10000, () => reqDestroy);
  });
}
let reqDestroy = () => {};

(async () => {
  let failures = 0;

  // 1. Missing URL -> 422
  try {
    await startServer();
    const bad = await post('/api/scan', {});
    if (bad.status !== 422) {
      console.log(`FAIL  empty body should be 422, got ${bad.status}`);
      failures += 1;
    } else {
      console.log('PASS  missing URL rejected with 422');
    }
  } catch (err) {
    console.log(`FAIL  empty-body test: ${err.message}`);
    failures += 1;
  }

  // 2. Local/private URL -> 422 (SSRF guard)
  try {
    const local = await post('/api/scan', { url: 'http://127.0.0.1/' });
    if (local.status !== 422) {
      console.log(`FAIL  private URL should be 422, got ${local.status}`);
      failures += 1;
    } else {
      console.log('PASS  private/local URL rejected with 422');
    }
  } catch (err) {
    console.log(`FAIL  private-URL test: ${err.message}`);
    failures += 1;
  }

  // 3. Valid URL -> 200 with score/verdict/checks
  try {
    const good = await post('/api/scan', {
      url: 'https://example.com',
    });
    if (good.status !== 200) {
      console.log(`FAIL  valid URL should be 200, got ${good.status}`);
      failures += 1;
    } else {
      let body;
      try {
        body = JSON.parse(good.body);
      } catch {
        console.log('FAIL  scan response is not JSON');
        failures += 1;
        await stopServer();
        process.exit(1);
      }
      const required = ['id', 'url', 'score', 'verdict', 'checks'];
      const missing = required.filter((k) => !(k in body));
      if (missing.length) {
        console.log(`FAIL  scan response missing: ${missing.join(', ')}`);
        failures += 1;
      } else if (
        typeof body.score !== 'number' ||
        body.score < 0 ||
        body.score > 100
      ) {
        console.log(`FAIL  score out of range: ${body.score}`);
        failures += 1;
      } else if (
        !['safe', 'suspicious', 'malicious', 'unknown'].includes(body.verdict)
      ) {
        console.log(`FAIL  invalid verdict: ${body.verdict}`);
        failures += 1;
      } else {
        console.log(
          `PASS  valid scan returned score=${body.score} verdict=${body.verdict}`
        );
      }
    }
  } catch (err) {
    console.log(`FAIL  valid-URL test: ${err.message}`);
    failures += 1;
  }

  await stopServer();
  if (failures) {
    console.log(`\nScan verification failed: ${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nscan verification passed');
})();
