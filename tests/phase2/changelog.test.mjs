// tests/phase2/changelog.test.mjs
//
// Unit tests for scripts/changelog.mjs. Verifies that the script
// classifies commits into Conventional-Commit buckets and emits
// markdown. Uses the real git history of the repo so we don't have to
// fabricate commits.

import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'changelog.mjs');

test('changelog: emits markdown with at least one bucket', () => {
  const out = mkdtempSync(join(tmpdir(), 'phase2-cl-'));
  const target = join(out, 'changelog.md');
  try {
    // Run against the entire log (since the repo inception).
    execFileSync('node', [SCRIPT, '--since', 'HEAD~500', '--until', 'HEAD', '--out', target], {cwd: REPO_ROOT});
    const md = readFileSync(target, 'utf8');
    assert.match(md, /^# Changelog/);
    assert.match(md, /^## /m);
  } finally { rmSync(out, {recursive: true, force: true}); }
});