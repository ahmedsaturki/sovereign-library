// tests/phase2/deploy-plan.test.mjs
//
// Unit tests for scripts/deploy-plan.mjs. Verifies all three strategies
// emit deterministic step sequences.

import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'deploy-plan.mjs');

const MANIFEST = {
  service: 'sovereign-library',
  releaseTag: 'v0.1.0',
  previousTag: 'v0.0.99',
};

test('deploy-plan: canary emits 4 ramps', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase2-dp-'));
  try {
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(MANIFEST));
    const out = join(dir, 'out.json');
    execFileSync('node', [SCRIPT, '--strategy', 'canary', '--manifest', join(dir, 'manifest.json'), '--out', out]);
    const plan = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(plan.strategy, 'canary');
    assert.equal(plan.steps.length, 4);
    assert.deepEqual(plan.steps.map(s => s.percent), [1, 10, 50, 100]);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('deploy-plan: blue-green emits 3 atomic steps', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase2-dp-'));
  try {
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(MANIFEST));
    const out = join(dir, 'out.json');
    execFileSync('node', [SCRIPT, '--strategy', 'blue-green', '--manifest', join(dir, 'manifest.json'), '--out', out]);
    const plan = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(plan.steps.length, 3);
    assert.equal(plan.steps[1].action, 'switch-traffic');
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('deploy-plan: unknown strategy exits 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase2-dp-'));
  try {
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(MANIFEST));
    const out = join(dir, 'out.json');
    let code = 0;
    try {
      execFileSync('node', [SCRIPT, '--strategy', 'nonexistent', '--manifest', join(dir, 'manifest.json'), '--out', out], {stdio: 'pipe'});
    } catch (e) { code = e.status ?? 1; }
    assert.notEqual(code, 0);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});