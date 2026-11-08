import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 31973;
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
    const data = JSON.stringify(body);
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
        timeout: 10000,
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
    const req = http
      .get(`http://127.0.0.1:${PORT}${path}`, (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => resolve({ status: res.statusCode, body: out }));
      })
      .on('error', reject)
      .setTimeout(10000, () => {
        req.destroy(new Error('timeout'));
      });
  });
}

(async () => {
  let failures = 0;
  const reportUrl = `https://storage-test-${Date.now()}.example`;

  try {
    await startServer();

    // Write a report
    const created = await post('/api/feed/report', {
      url: reportUrl,
      type: 'phishing',
      source: 'verify-storage',
    });
    if (created.status !== 201) {
      console.log(`FAIL  report create should be 201, got ${created.status}`);
      failures += 1;
    } else {
      console.log('PASS  report created with 201');
    }

    // Read it back via feed (the server normalizes the URL with a trailing slash)
    const feed = await get('/api/feed');
    if (feed.status !== 200) {
      console.log(`FAIL  feed should be 200, got ${feed.status}`);
      failures += 1;
    } else {
      let body;
      try {
        body = JSON.parse(feed.body);
      } catch {
        console.log('FAIL  feed response is not JSON');
        failures += 1;
        await stopServer();
        process.exit(1);
      }
      const found = body.reports.some((r) => r.url === reportUrl || r.url === reportUrl + '/');
      if (!found) {
        console.log('FAIL  reported URL not present in feed');
        failures += 1;
      } else {
        console.log('PASS  report persisted and readable from feed');
      }
    }
  } catch (err) {
    console.log(`FAIL  storage test: ${err.message}`);
    failures += 1;
  }

  await stopServer();
  if (failures) {
    console.log(`\nStorage verification failed: ${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nstorage verification passed');
})();
