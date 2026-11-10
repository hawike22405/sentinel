import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
// Verify the React build actually served by Express, rather than the obsolete root mockup.
const html = readFileSync('public/index.html', 'utf8');
assert.match(html, /id="root"/);
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m => m[1]);
assert.ok(assets.some(p => p.endsWith('.js')));
assert.ok(assets.some(p => p.endsWith('.css')));
for (const path of assets) assert.ok(existsSync('public' + path), 'Missing built asset: ' + path);
for (const path of ['App.jsx', 'components/Hero.jsx', 'components/ScanResult.jsx', 'components/ThreatFeed.jsx']) {
  assert.ok(readFileSync('client/src/' + path, 'utf8').length > 0);
}
console.log('website verification passed (React source and production assets)');
