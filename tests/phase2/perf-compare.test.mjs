// tests/phase2/perf-compare.test.mjs
//
// Unit tests for scripts/perf-compare.mjs. Verifies that a perf result
// within the threshold reports ok and one above the threshold reports
// regression.

import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'perf-compare.mjs');

test('perf-compare: ok within threshold', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase2-pc-'));
  try {
    const current = {benches: [{label: 'x.y', p95_ms: 1.0}]};
    const baseline = {benches: [{label: 'x.y', p95_ms: 1.0}]};
    writeFileSync(join(dir, 'cur.json'), JSON.stringify(current));
    writeFileSync(join(dir, 'base.json'), JSON.stringify(baseline));
    const out = join(dir, 'out.json');
    execFileSync('node', [SCRIPT, '--current', join(dir, 'cur.json'), '--baseline', join(dir, 'base.json'), '--threshold', '1.20', '--out', out]);
    const r = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(r.summary.regressions, 0);
    assert.equal(r.summary.ok, 1);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('perf-compare: flags regression above threshold', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase2-pc-'));
  try {
    const current = {benches: [{label: 'x.y', p95_ms: 2.0}]};
    const baseline = {benches: [{label: 'x.y', p95_ms: 1.0}]};
    writeFileSync(join(dir, 'cur.json'), JSON.stringify(current));
    writeFileSync(join(dir, 'base.json'), JSON.stringify(baseline));
    const out = join(dir, 'out.json');
    let code = 0;
    try {
      execFileSync('node', [SCRIPT, '--current', join(dir, 'cur.json'), '--baseline', join(dir, 'base.json'), '--threshold', '1.20', '--out', out], {stdio: 'pipe'});
    } catch (e) { code = e.status ?? 1; }
    const r = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(r.summary.regressions, 1);
    assert.notEqual(code, 0);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});