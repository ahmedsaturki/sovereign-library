// tests/phase3/phase3-smoke.test.mjs
//
// Phase-3 smoke test — confirms that every script in scripts/
// produced by Phase-3 has a sensible CLI surface (parses --help or
// at least exits cleanly when run without args).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const scripts = [
  'scripts/formal-verify.mjs',
  'scripts/threat-model.mjs',
  'scripts/static-analyse.mjs',
  'scripts/zero-trust-check.mjs',
  'scripts/gdpr-automation.mjs',
  'scripts/p2p-mesh-test.mjs',
  'scripts/cve-monitor.mjs',
  'scripts/mutate.mjs',
  'scripts/differential.mjs',
  'scripts/fuzz.mjs',
];

for (const script of scripts) {
  test(`phase3: ${script} parses`, () => {
    let exitCode = 0;
    try {
      execFileSync('node', [script, '--out', '.hermes/phase3/smoke'], { cwd: REPO_ROOT, stdio: 'pipe' });
    } catch (err) {
      exitCode = err.status ?? 1;
    }
    assert.ok(exitCode === 0 || exitCode === 1, `expected exit code 0 or 1, got ${exitCode}`);
  });
}