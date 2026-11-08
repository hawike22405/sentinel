import { readFileSync } from 'node:fs';

const ROOT = process.cwd();

const REQUIRED = [
  { file: 'PRD.md', expects: ['target user', 'core user flow', 'acceptance', 'non-goal'] },
  { file: 'DESIGN.md', expects: ['```yaml', 'colors', 'typography', 'spacing', 'rounded', 'components'] },
  { file: 'AGENTS.md', expects: ['build', 'test', 'directory', 'allow-list'] },
  { file: 'CLAUDE.md', expects: ['AGENTS'] },
  { file: 'docs/architecture.md', expects: ['boundary', 'integration', 'state management'] },
  { file: 'docs/code-standards.md', expects: ['pattern', 'utilities'] },
  { file: 'public/llms.txt', expects: ['#', 'documentation'] },
  { file: 'context/progress.md', expects: ['completed', 'active', 'next steps'] },
];

let failures = 0;

for (const { file, expects } of REQUIRED) {
  const path = `${ROOT}/${file}`;
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    console.log(`FAIL  ${file}  (missing)`);
    failures += 1;
    continue;
  }
  const lower = content.toLowerCase();
  const missing = expects.filter((e) => !lower.includes(e.toLowerCase()));
  if (missing.length) {
    console.log(`FAIL  ${file}  (missing: ${missing.join(', ')})`);
    failures += 1;
  } else {
    console.log(`PASS  ${file}`);
  }
}

if (failures) {
  console.log(`\nFoundation verification failed: ${failures} file(s) incomplete.`);
  process.exit(1);
}

console.log('\nfoundation verification passed');
