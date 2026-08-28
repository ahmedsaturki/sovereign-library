// Create repo-root node_modules/@sovereign/<cube> links for in-repo Product test
// resolution. The Products' published source imports cubes via the `#browser*` subpath
// specifiers (mapped in products/<product>/package.json to @sovereign/*). The published
// artifact injects these via package-stage; in-repo tests need the same resolution so
// `node --test` can load the Product source. This mirrors the published dependency closure
// exactly and is gitignored (node_modules/), so it never enters the repository.
//
// Cross-platform: uses directory junctions on Windows (no privilege needed) and symlinks
// elsewhere.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = path.join(ROOT, 'node_modules', '@sovereign');
fs.mkdirSync(targetDir, { recursive: true });

const cubes = [
  'browser',
  'browser-assertions',
  'browser-interactions',
  'browser-network-interception',
  'browser-tab-manager',
  'browser-visual-testing',
  'browser-recorder',
];

for (const cube of cubes) {
  const link = path.join(targetDir, cube);
  const target = path.join(ROOT, 'cubes', cube);
  if (!fs.existsSync(target)) continue;
  if (fs.existsSync(link) || fs.lstatSync(link, { throwIfNoEntry: false })) {
    try { fs.rmSync(link, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  try {
    fs.symlinkSync(path.relative(targetDir, target), link, 'junction');
  } catch {
    fs.cpSync(target, link, { recursive: true });
  }
}

console.log(`linked ${cubes.length} browser cubes into node_modules/@sovereign`);
