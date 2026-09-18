import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
}

test('mutation runner never evaluates a caller-provided shell command', () => {
  const source = readFileSync(join(ROOT, 'scripts', 'mutate.mjs'), 'utf8');
  assert.doesNotMatch(source, /execFileSync\\(\\s*['"](?:sh|bash|cmd|powershell|pwsh)['"]/u);
  assert.doesNotMatch(source, /['"]-c['"]\\s*,\\s*testCmd/u);
  assert.match(source, /execFileSync\\(process\\.execPath, \\['--test', testTarget\\]/u);
  assert.match(source, /shell:\\s*false/u);
});

test('mutation runner rejects test targets outside the repository', () => {
  const result = runNode([
    'scripts/mutate.mjs',
    '--target', 'cubes/retry',
    '--test', '../../outside.test.js',
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + '\\n' + result.stderr, /repository|does not exist/u);
});

test('GDPR portability rejects path-bearing subject identifiers', () => {
  const out = mkdtempSync(join(tmpdir(), 'sovereign-gdpr-test-'));
  try {
    const result = runNode([
      'privacy/gdpr-automation/scripts/portability.mjs',
      '--subject', '../../escape',
    ]);
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(join(out, 'escape.portability.json')), false);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('CVE watch rejects path-bearing package identifiers', () => {
  const result = runNode([
    'security/cve-monitoring/scripts/watch.mjs',
    '--package', '../../escape',
  ]);
  assert.notEqual(result.status, 0);
});
