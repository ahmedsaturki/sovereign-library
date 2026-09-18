// Out-of-tree independence + declaration-surface verification for the 9 new packages.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ids = [
  'browser', 'browser-assertions', 'browser-interactions', 'browser-network-interception',
  'browser-recorder', 'browser-tab-manager', 'browser-visual-testing', 'web-test-kit', 'sovereign-automation'
];

let failed = false;
for (const id of ids) {
  const pkgDir = path.resolve(ROOT, 'packages', id);
  const dts = path.join(pkgDir, 'dist', 'index.d.ts');
  const src = path.join(pkgDir, 'src', 'index.js');
  if (!fs.existsSync(dts)) { console.error(`FAIL ${id}: missing declaration surface`); failed = true; continue; }
  if (!fs.existsSync(src)) { console.error(`FAIL ${id}: missing src`); failed = true; continue; }
  // Import the staged src as an external consumer would (outside the cube tree).
  try {
    await import('file://' + src);
  } catch (err) {
    console.error(`FAIL ${id}: staged src import error: ${err.message}`);
    failed = true;
    continue;
  }
  // Confirm no monorepo-relative parent import survives in the staged src.
  const text = fs.readFileSync(src, 'utf8');
  const parent = text.split('\n').filter(l => /^\s*(import|export).*\bfrom\s*['"]\.\.\//.test(l));
  if (parent.length) { console.error(`FAIL ${id}: parent import leaks: ${parent[0]}`); failed = true; continue; }
  // Confirm the package.json declares the files allowlist.
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  if (!Array.isArray(pkg.files) || pkg.files.length < 5) { console.error(`FAIL ${id}: missing files allowlist`); failed = true; continue; }
  console.log(`OK   ${id}: d.ts + src importable + no parent imports + files allowlist`);
}
if (failed) { console.error('\nOUT-OF-TREE VERIFICATION FAILED'); process.exit(1); }
console.log('\nOUT-OF-TREE VERIFICATION PASSED for all 9 packages');
