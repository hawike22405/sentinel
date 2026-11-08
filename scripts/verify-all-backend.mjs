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

run('node scripts/gate-lint.mjs GATES.backend.md');
run('node scripts/verify-deps.mjs');
run('node scripts/verify-server.mjs');
run('node scripts/verify-scan.mjs');
run('node scripts/verify-storage.mjs');

if (!ok) {
  console.log('\nfull backend verification failed');
  process.exit(1);
}

console.log('\nfull backend verification passed');
