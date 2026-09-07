// tests/phase2/feature-flags.test.mjs
//
// Unit tests for scripts/feature-flags.mjs. The script is dependency-free
// and only reads JSON + environment variables, so the tests just exercise
// rule evaluation through different (env, phase, pr) tuples.

import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'feature-flags.mjs');

test('feature-flags: defaults when no rules match', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase2-ff-'));
  try {
    writeFileSync(join(dir, 'flags.json'), JSON.stringify({
      flags: [
        {key: 'always_default_false', default: false, rules: []},
        {key: 'always_default_true',  default: true,  rules: []},
      ],
    }));
    const out = join(dir, 'out.json');
    execFileSync('node', [SCRIPT, '--flags', join(dir, 'flags.json'), '--out', out], {
      env: {...process.env, SOVEREIGN_ENV: 'dev', SOVEREIGN_PHASE: 'phase0'},
    });
    const report = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(report.summary.enabled, 1);
    assert.equal(report.summary.disabled, 1);
    assert.equal(report.flags[0].value, false);
    assert.equal(report.flags[1].value, true);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('feature-flags: env-scoped rule fires first', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase2-ff-'));
  try {
    writeFileSync(join(dir, 'flags.json'), JSON.stringify({
      flags: [
        {key: 'phase2_canary', default: false, rules: [
          {when: {env: 'prod', phase: 'phase2'}, value: true},
        ]},
      ],
    }));
    const out = join(dir, 'out.json');
    execFileSync('node', [SCRIPT, '--flags', join(dir, 'flags.json'), '--out', out], {
      env: {...process.env, SOVEREIGN_ENV: 'prod', SOVEREIGN_PHASE: 'phase2'},
    });
    const report = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(report.flags[0].value, true);
    assert.deepEqual(report.flags[0].matched, {env: 'prod', phase: 'phase2'});
  } finally { rmSync(dir, {recursive: true, force: true}); }
});