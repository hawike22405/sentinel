import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  createScan,
  getScanById,
  createReport,
  listReports,
} from './store.js';
import { scan, validateUrl } from './detector.js';

const router = Router();

router.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sentinel' });
});

router.post('/api/scan', async (req, res, next) => {
  try {
    const { url } = req.body || {};
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(422).json({ error: 'A URL is required.' });
    }

    const validated = validateUrl(url.trim());
    if (!validated.ok) {
      return res.status(422).json({ error: validated.error });
    }

    const result = await scan(validated.url);
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
    const { url, type, source } = req.body || {};
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(422).json({ error: 'A URL is required.' });
    }
    if (!type || typeof type !== 'string') {
      return res.status(422).json({ error: 'A report type is required.' });
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
      source: source || 'user-report',
    });

    res.status(201).json({
      id,
      url: validated.url.href,
      type,
      source: source || 'user-report',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
