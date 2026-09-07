// tests/phase2/rollback.test.mjs
//
// Unit tests for scripts/rollback.mjs. Verifies that the rollback plan
// references the expected abort triggers and concrete commands.

import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'rollback.mjs');

test('rollback: emits 7 ordered steps and concrete commands', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase2-rb-'));
  try {
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
      service: 'sovereign', previousTag: 'v0.0.99',
    }));
    const out = join(dir, 'out.json');
    execFileSync('node', [SCRIPT, '--manifest', join(dir, 'manifest.json'), '--out', out]);
    const plan = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(plan.steps.length, 7);
    assert.equal(plan.steps[0].action, 'freeze-traffic');
    assert.equal(plan.steps[1].action, 'rollback-image');
    assert.ok(plan.triggers.length >= 3);
    assert.ok(plan.commands.freezeTraffic.includes('sovereign'));
  } finally { rmSync(dir, {recursive: true, force: true}); }
});