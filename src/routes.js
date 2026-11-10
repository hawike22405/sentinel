import { Router } from 'express';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { createScan, getScanById, createReport, deleteReport, listReports, countReportsForHost, storageUrl } from './store.js';
import { scan, validateUrl } from './detector.js';
import { logSecurity } from './security-log.js';

const router = Router();
const MAX_URL_LENGTH = 2048;
const MAX_CONCURRENT_SCANS = 10;
const REPORT_TYPES = ['phishing', 'malware', 'scam', 'impersonation', 'other'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let inFlight = 0;

const isBlockedTarget = (msg) => /private|local/i.test(msg || '');

// 1/9. Admin auth: bearer token from the environment, compared in constant time.
// With no ADMIN_TOKEN configured the admin surface does not exist (404).
function requireAdmin(req, res, next) {
  const configured = process.env.ADMIN_TOKEN;
  if (!configured) return res.status(404).json({ error: 'Not found.' });
  const m = /^Bearer (.{1,256})$/.exec(req.get('authorization') || '');
  const digest = (s) => createHash('sha256').update(s).digest();
  if (!m || !timingSafeEqual(digest(m[1]), digest(configured))) {
    logSecurity('admin_auth_failed', { ip: req.ip, path: req.path });
    return res.status(401).set('WWW-Authenticate', 'Bearer').json({ error: 'Unauthorized.' });
  }
  next();
}

router.get('/api/health', (_req, res) => res.json({ ok: true, service: 'sentinel' }));

router.post('/api/scan', async (req, res, next) => {
  try {
    const { url } = req.body || {};
    if (typeof url !== 'string' || !url.trim()) return res.status(422).json({ error: 'A URL is required.' });
    if (url.length > MAX_URL_LENGTH) return res.status(422).json({ error: 'That URL is too long.' });

    const validated = validateUrl(url.trim());
    if (!validated.ok) {
      logSecurity(isBlockedTarget(validated.error) ? 'ssrf_blocked' : 'invalid_url', { ip: req.ip, url });
      return res.status(422).json({ error: validated.error });
    }

    if (inFlight >= MAX_CONCURRENT_SCANS) {
      logSecurity('scan_capacity', { ip: req.ip });
      return res.status(503).set('Retry-After', '5').json({ error: 'Scanner is busy. Try again shortly.' });
    }
    inFlight += 1;
    let result;
    try {
      result = await scan(validated.url, { communityReports: countReportsForHost(validated.url.hostname) });
    } finally {
      inFlight -= 1;
    }
    if (result.error) {
      if (isBlockedTarget(result.error)) logSecurity('ssrf_blocked', { ip: req.ip, url });
      return res.status(422).json({ error: result.error });
    }

    const id = randomUUID();
    createScan({ id, url: validated.url.href, score: result.score, verdict: result.verdict, details: result });
    res.json({ ...result, id, url: storageUrl(validated.url), created_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

router.get('/api/scan/:id', (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid scan id.' });
    const record = getScanById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Scan not found.' });
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.get('/api/feed', (_req, res) => res.json({ reports: listReports(50) }));

router.post('/api/feed/report', (req, res, next) => {
  try {
    const { url, type } = req.body || {};
    if (typeof url !== 'string' || !url.trim()) return res.status(422).json({ error: 'A URL is required.' });
    if (url.length > MAX_URL_LENGTH) return res.status(422).json({ error: 'That URL is too long.' });
    if (!REPORT_TYPES.includes(type)) return res.status(422).json({ error: 'Report type must be one of: ' + REPORT_TYPES.join(', ') + '.' });
    const validated = validateUrl(url.trim());
    if (!validated.ok) {
      logSecurity('invalid_url', { ip: req.ip, url, via: 'report' });
      return res.status(422).json({ error: validated.error });
    }
    const id = randomUUID();
    const inserted = createReport({ id, url: validated.url.href, type, source: 'user-report' }); // never trust a client-supplied source
    if (!inserted) return res.status(409).json({ error: 'This host and report type have already been reported.' });
    res.status(201).json({ id, url: storageUrl(validated.url), type, source: 'user-report', verified: false });
  } catch (err) {
    next(err);
  }
});

// Moderation: remove an abusive or mistaken community report.
router.delete('/api/admin/reports/:id', requireAdmin, (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid report id.' });
    if (!deleteReport(req.params.id)) return res.status(404).json({ error: 'Report not found.' });
    logSecurity('admin_report_deleted', { ip: req.ip, id: req.params.id });
    res.json({ deleted: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;
