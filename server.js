import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { join } from 'node:path';
import routes from './src/routes.js';
import { closeStore } from './src/store.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy only when explicitly opted in (behind a reverse proxy).
app.set('trust proxy', process.env.TRUST_PROXY === '1');

// Rate limiting: general + stricter on scan/report endpoints.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many scan/report requests. Please slow down.' },
});

app.use(generalLimiter);

// Security headers on every response.
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none';");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// CORS: restrict to known frontend origins. Adjust for production.
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  })
);

app.use(express.json({ limit: '64kb' }));

app.use(routes);

// Serve the static frontend (index.html + assets) so the app and API share one origin.
app.use(express.static('.'));
app.get('/', (_req, res) => {
  res.sendFile(join(process.cwd(), 'index.html'));
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Error handler: never leak stack traces to the client.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const server = app.listen(PORT, () => {
  console.log(`Sentinel backend listening on http://localhost:${PORT}`);
});

const shutdown = () => {
  server.close(() => {
    closeStore();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
