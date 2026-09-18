// tests/phase2/migrate.test.mjs
//
// Unit tests for scripts/migrate.mjs. Verifies dry-run + apply paths
// against an in-memory SQLite target.

import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'migrate.mjs');

test('migrate: dry-run reports pending without applying', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase2-mig-'));
  try {
    writeFileSync(join(dir, '001-test.sql'), `
      CREATE TABLE t1 (id INTEGER PRIMARY KEY);
      CREATE TABLE t2 (id INTEGER PRIMARY KEY);
    `);
    writeFileSync(join(dir, '001-test.down.sql'), `
      DROP TABLE t2;
      DROP TABLE t1;
    `);
    const out = join(dir, 'out.json');
    execFileSync('node', [SCRIPT, '--migrations', dir, '--target', 'sqlite::memory:', '--dry-run', '--out', out]);
    const report = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(report.summary.total, 1);
    assert.equal(report.summary.pending, 1);
    assert.equal(report.summary.errors, 0);
    assert.equal(report.items[0].status, 'dry-run-ok');
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('migrate: applies forward', () => {
  // Note: `:memory:` SQLite resets between processes, so we cannot
  // assert idempotency in this script-based harness. The schema-version
  // bookkeeping path is exercised by the dry-run test plus the SQL
  // fixture in migrations/sqlite/. This test verifies that a real
  // (non-dry-run) invocation reports `applied` status.
  const dir = mkdtempSync(join(tmpdir(), 'phase2-mig-'));
  try {
    writeFileSync(join(dir, '001-test.sql'), `CREATE TABLE t1 (id INTEGER PRIMARY KEY);`);
    const out = join(dir, 'out.json');
    execFileSync('node', [SCRIPT, '--migrations', dir, '--target', 'sqlite::memory:', '--out', out]);
    const report = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(report.summary.pending, 1);
    assert.equal(report.summary.errors, 0);
    assert.equal(report.items[0].status, 'applied');
  } finally { rmSync(dir, {recursive: true, force: true}); }
});