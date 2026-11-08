import { readFileSync } from 'node:fs';
import { statSync } from 'node:fs';

let failures = 0;

function check(rel, label) {
  try {
    statSync(rel);
    console.log(`PASS  ${label}`);
  } catch {
    console.log(`FAIL  ${label} (missing: ${rel})`);
    failures += 1;
  }
}

check('package.json', 'package.json exists');
check('package-lock.json', 'package-lock.json exists (reproducible install)');
check('node_modules', 'node_modules installed');
check('node_modules/express/package.json', 'express installed');
check('node_modules/better-sqlite3/package.json', 'better-sqlite3 installed');
check('node_modules/express-rate-limit/package.json', 'express-rate-limit installed');
check('node_modules/cors/package.json', 'cors installed');

// Validate package.json is parseable and has type module + scripts.
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  if (pkg.type !== 'module') {
    console.log('FAIL  package.json (type is not "module")');
    failures += 1;
  } else {
    console.log('PASS  package.json type=module');
  }
  if (!pkg.scripts || !pkg.scripts.start) {
    console.log('FAIL  package.json (missing start script)');
    failures += 1;
  } else {
    console.log('PASS  package.json start script present');
  }
} catch (err) {
  console.log(`FAIL  package.json (unparseable: ${err.message})`);
  failures += 1;
}

if (failures) {
  console.log(`\nDependencies verification failed: ${failures} check(s) failed.`);
  process.exit(1);
}

console.log('\ndependencies verification passed');
