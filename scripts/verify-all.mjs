import { execSync } from 'node:child_process';

let ok = true;

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch (err) {
    console.log(`FAILED: ${cmd}`);
    ok = false;
    return false;
  }
}

run('node scripts/gate-lint.mjs GATES.md');
run('node scripts/verify-foundation.mjs');
run('node scripts/verify-website.mjs');

if (!ok) {
  console.log('\nfull verification failed');
  process.exit(1);
}

console.log('\nfull verification passed');
