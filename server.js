import './src/env.js'; // first: loads .env
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './src/routes.js';
import { closeStore } from './src/store.js';
import { logSecurity } from './src/security-log.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT === '0' ? 0 : Number(process.env.PORT) || 3000;
const FORCE_HTTPS = process.env.FORCE_HTTPS === '1';
const PUBLIC_HOST = process.env.PUBLIC_HOST;

if (FORCE_HTTPS && !PUBLIC_HOST) {
  console.error('FORCE_HTTPS=1 requires PUBLIC_HOST (the canonical hostname).');
  process.exit(1);
}
if (process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN.length < 32) {
  console.warn('ADMIN_TOKEN is shorter than 32 characters: admin endpoint disabled.');
  delete process.env.ADMIN_TOKEN;
}

const app = express();
app.disable('x-powered-by');
// Trust exactly one proxy hop, and only when explicitly enabled.
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

// 4. Enforce HTTPS (TLS itself is terminated by a reverse proxy / platform).
if (FORCE_HTTPS) {
  app.use((req, res, next) => (req.secure ? next() : res.redirect(308, `https://${PUBLIC_HOST}${req.originalUrl}`)));
}

// 14. Security headers on every response.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  );
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// 13. CORS is off unless a single frontend origin is configured. The bundled frontend is same-origin.
if (process.env.FRONTEND_ORIGIN) {
  app.use(cors({ origin: [process.env.FRONTEND_ORIGIN], methods: ['GET', 'POST', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'], maxAge: 600 }));
}

// 12. Rate limiting (+ 8. logging of every limit hit).
const limiter = (limit, message) =>
  rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logSecurity('rate_limited', { ip: req.ip, method: req.method, path: req.path });
      res.status(429).json({ error: message });
    },
  });
app.use(limiter(Number(process.env.GENERAL_LIMIT) || 120, 'Too many requests. Please slow down.'));
app.use('/api/admin', limiter(10, 'Too many admin requests.'));
app.post(['/api/scan', '/api/feed/report'], limiter(Number(process.env.STRICT_LIMIT) || 15, 'Too many scan/report requests. Please slow down.'));

// 16/18. State-changing API calls must be JSON: blocks form posts, text/plain tricks and multipart uploads.
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && !req.is('application/json')) {
    logSecurity('bad_content_type', { ip: req.ip, path: req.path, type: req.get('content-type') || '' });
    return res.status(415).json({ error: 'Content-Type must be application/json.' });
  }
  next();
});
app.use(express.json({ limit: '16kb', type: 'application/json' }));

app.use(routes);

// 23. Serve ONLY the public frontend (React build); never the repo root.
app.use(express.static(join(ROOT, 'public'), { dotfiles: 'deny' }));
app.get('/', (_req, res) => res.sendFile(join(ROOT, 'public', 'index.html')));

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// 20. Errors never leak stack traces or internals.
app.use((err, req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    logSecurity('bad_json', { ip: req.ip, path: req.path });
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    logSecurity('body_too_large', { ip: req.ip, path: req.path });
    return res.status(413).json({ error: 'Request body is too large.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const server = app.listen(PORT, () => {
  console.log(`Sentinel backend listening on http://localhost:${server.address().port}`);
});

const shutdown = () => {
  server.close(() => {
    closeStore();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
