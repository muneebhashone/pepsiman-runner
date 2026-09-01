/**
 * Zero-dep syntax check for all game modules.
 * Run: node scripts/syntax-check.mjs
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gameDir = join(root, 'src/game');
const files = readdirSync(gameDir)
  .filter((f) => f.endsWith('.js'))
  .sort();

let failed = 0;
for (const file of files) {
  const path = join(gameDir, file);
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status === 0) {
    console.log(`OK ${file}`);
  } else {
    failed += 1;
    console.error(`FAIL ${file}`);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

if (failed) {
  console.error(`\n${failed} file(s) failed syntax check`);
  process.exit(1);
}

console.log(`\nAll ${files.length} game modules passed syntax check.`);
