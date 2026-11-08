import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 31971;
let serverProc;
let resolved = false;

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
    serverProc.on('exit', (code) => {
      if (!ready && !resolved) {
        reject(new Error(`Server exited early with code ${code}`));
      }
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

function get(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${PORT}${path}`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      })
      .on('error', reject)
      .setTimeout(5000, () => {
        req.destroy(new Error('timeout'));
      });
  });
}

function getHealth() {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: data });
        });
      })
      .on('error', reject)
      .setTimeout(5000, () => {
        req.destroy(new Error('timeout'));
      });
  });
}

(async () => {
  let failures = 0;
  try {
    await startServer();
    const res = await getHealth();
    if (res.status !== 200) {
      console.log(`FAIL  health endpoint returned ${res.status}`);
      failures += 1;
    } else {
      let body;
      try {
        body = JSON.parse(res.body);
      } catch {
        console.log('FAIL  health endpoint body is not JSON');
        failures += 1;
        await stopServer();
        process.exit(1);
      }
      if (body.ok !== true) {
        console.log('FAIL  health endpoint ok is not true');
        failures += 1;
      } else {
        console.log('PASS  health endpoint responded { ok: true }');
      }

      // Static frontend served from same origin so fetch('/api/scan') works.
      try {
        const root = await get('/');
        if (root.status !== 200 || !/<html/i.test(root.body)) {
          console.log('FAIL  root should serve index.html');
          failures += 1;
        } else {
          console.log('PASS  static frontend served at root');
        }
      } catch (err) {
        console.log('FAIL  static root check: ' + err.message);
        failures += 1;
      }
    }
  } catch (err) {
    console.log(`FAIL  server startup/health check: ${err.message}`);
    failures += 1;
  }
  await stopServer();
  if (failures) {
    console.log(`\nServer verification failed: ${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nserver verification passed');
})();
