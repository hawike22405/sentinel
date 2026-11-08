import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  createScan,
  getScanById,
  createReport,
  listReports,
  countReportsForHost,
} from './store.js';
import { scan, validateUrl } from './detector.js';

const router = Router();
const MAX_URL_LENGTH = 2048;
const REPORT_TYPES = ['phishing', 'malware', 'scam', 'impersonation', 'other'];

router.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sentinel' });
});

router.post('/api/scan', async (req, res, next) => {
  try {
    const { url } = req.body || {};
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(422).json({ error: 'A URL is required.' });
    }

    if (url.length > MAX_URL_LENGTH) {
      return res.status(422).json({ error: 'That URL is too long.' });
    }

    const validated = validateUrl(url.trim());
    if (!validated.ok) {
      return res.status(422).json({ error: validated.error });
    }

    const result = await scan(validated.url, {
      communityReports: countReportsForHost(validated.url.hostname),
    });
    if (result.error) {
      return res.status(422).json({ error: result.error });
    }

    const id = randomUUID();
    createScan({
      id,
      url: validated.url.href,
      score: result.score,
      verdict: result.verdict,
      details: { checks: result.checks, reasons: result.reasons },
    });

    res.json({
      id,
      url: validated.url.href,
      score: result.score,
      verdict: result.verdict,
      checks: result.checks,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api/scan/:id', (_req, res, next) => {
  try {
    const scanRecord = getScanById(_req.params.id);
    if (!scanRecord) {
      return res.status(404).json({ error: 'Scan not found.' });
    }
    res.json(scanRecord);
  } catch (err) {
    next(err);
  }
});

router.get('/api/feed', (_req, res) => {
  const reports = listReports(50);
  res.json({ reports });
});

router.post('/api/feed/report', (req, res, next) => {
  try {
    const { url, type } = req.body || {};
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(422).json({ error: 'A URL is required.' });
    }
    if (url.length > MAX_URL_LENGTH) {
      return res.status(422).json({ error: 'That URL is too long.' });
    }
    if (!REPORT_TYPES.includes(type)) {
      return res.status(422).json({ error: 'Report type must be one of: ' + REPORT_TYPES.join(', ') + '.' });
    }
    const validated = validateUrl(url.trim());
    if (!validated.ok) {
      return res.status(422).json({ error: validated.error });
    }

    const id = randomUUID();
    createReport({
      id,
      url: validated.url.href,
      type,
      source: 'user-report', // never trust a client-supplied source
    });

    res.status(201).json({
      id,
      url: validated.url.href,
      type,
      source: 'user-report',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
