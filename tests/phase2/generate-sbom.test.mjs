// tests/phase2/generate-sbom.test.mjs
//
// Unit tests for scripts/generate-sbom.mjs. Verifies that the SBOM
// digest is deterministic and stable across runs.

import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'generate-sbom.mjs');

function makeRepoMirror() {
  const dir = mkdtempSync(join(tmpdir(), 'phase2-sb-'));
  mkdirSync(join(dir, 'pkg-foo', 'src'), {recursive: true});
  writeFileSync(join(dir, 'pkg-foo', 'package.json'), JSON.stringify({
    name: '@sovereign/foo',
    version: '0.1.0',
    type: 'module',
    files: ['src/index.js', 'README.md'],
  }));
  writeFileSync(join(dir, 'pkg-foo', 'src', 'index.js'), 'export const foo = 1;\n');
  writeFileSync(join(dir, 'pkg-foo', 'README.md'), 'foo\n');
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify({
    packages: [{name: '@sovereign/foo', directory: join(dir, 'pkg-foo'), version: '0.1.0', expected: ['foo']}],
  }));
  return dir;
}

test('generate-sbom: deterministic hash across runs', () => {
  const dir = makeRepoMirror();
  try {
    const out1 = join(dir, 'out1.json');
    const out2 = join(dir, 'out2.json');
    execFileSync('node', [SCRIPT, '--input', join(dir, 'catalog.json'), '--out', out1], {cwd: dir});
    execFileSync('node', [SCRIPT, '--input', join(dir, 'catalog.json'), '--out', out2], {cwd: dir});
    const a = JSON.parse(readFileSync(out1, 'utf8'));
    const b = JSON.parse(readFileSync(out2, 'utf8'));
    assert.equal(a.packageCount, b.packageCount);
    assert.equal(a.packages[0].sha256, b.packages[0].sha256);
    assert.match(a.packages[0].sha256, /^[0-9a-f]{64}$/);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});