import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import assert from 'node:assert/strict';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { default: ScanResult } = await server.ssrLoadModule('/src/components/ScanResult.jsx');
  const check = { status: 'warn', completed: false, detail: 'DNS unavailable in scanner backend.' };
  const result = { score: 0, verdict: 'unknown', assessment: 'incomplete', checks: {
    reputation: { status: 'ok', detail: 'No URL pattern signals.' }, headers: check, certificate: check, threat: { ...check, count: 0 },
  } };
  const html = renderToStaticMarkup(React.createElement(ScanResult, { result }));
  assert.ok(html.includes('Inconclusive'));
  assert.ok(html.includes('DNS unavailable in scanner backend.'));
  assert.ok(!html.includes('Verified Safe'));
  assert.ok(!html.includes('Let&#x27;s Encrypt'));
  assert.ok(html.includes('Not checked'));
  const empty = renderToStaticMarkup(React.createElement(ScanResult, { result: null }));
  assert.ok(!empty.includes('Verified Safe'));
  assert.ok(empty.includes('Enter a URL'));
  console.log('Result rendering passed: inconclusive connection failure, honest issuer and empty state.');
} finally { await server.close(); }
