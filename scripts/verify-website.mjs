import { readFileSync } from 'node:fs';

const ROOT = process.cwd();

let failures = 0;

function exists(rel) {
  try {
    readFileSync(`${ROOT}/${rel}`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

if (!exists('index.html')) {
  console.log('FAIL  index.html (missing)');
  failures += 1;
}
if (!exists('assets/css/style.css')) {
  console.log('FAIL  assets/css/style.css (missing)');
  failures += 1;
}
if (!exists('assets/js/app.js')) {
  console.log('FAIL  assets/js/app.js (missing)');
  failures += 1;
}

const html = exists('index.html') ? readFileSync(`${ROOT}/index.html`, 'utf8').toLowerCase() : '';
const lowerHtml = html;

const requiredSections = ['hero', 'threat', 'security', 'certificate', 'intelligence'];
for (const s of requiredSections) {
  if (!lowerHtml.includes(s)) {
    console.log(`FAIL  index.html (missing section keyword: ${s})`);
    failures += 1;
  }
}

const forbidden = ['lorem ipsum', 'coming soon', 'placeholder text', 'todo:'];
for (const f of forbidden) {
  if (lowerHtml.includes(f)) {
    console.log(`FAIL  index.html (contains placeholder slop: ${f})`);
    failures += 1;
  }
}

if (!lowerHtml.includes('.css') || !lowerHtml.includes('.js')) {
  console.log('FAIL  index.html (does not link CSS and JS assets)');
  failures += 1;
}

if (failures) {
  console.log(`\nWebsite verification failed: ${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\nwebsite verification passed');
