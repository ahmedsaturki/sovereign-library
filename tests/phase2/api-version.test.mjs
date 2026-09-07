// tests/phase2/api-version.test.mjs
//
// Unit tests for scripts/api-version.mjs. Runs as a node --test suite;
// the sovereign bounded-test runner picks it up via package.json.
//
// These tests construct a temporary repo mirror with stub package.json
// files so the production script's real I/O path is exercised.

import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'api-version.mjs');

function withTempRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'phase2-apiver-'));
  try {
    // Mirror the catalog under a unique directory.
    const catalog = {
      packages: [
        {name: '@sovereign/foo', directory: join(dir, 'pkg-foo'), version: '0.1.0', expected: ['resolve']},
        {name: '@sovereign/bar', directory: join(dir, 'pkg-bar'), version: '0.2.3', expected: ['Ok', 'Err']},
      ],
    };
    mkdirSync(join(dir, 'pkg-foo'));
    mkdirSync(join(dir, 'pkg-bar'));
    writeFileSync(join(dir, 'pkg-foo', 'package.json'), JSON.stringify({
      name: '@sovereign/foo', version: '0.1.0', type: 'module',
      exports: {'.': './src/index.js'},
      files: ['src/index.js'],
    }));
    writeFileSync(join(dir, 'pkg-bar', 'package.json'), JSON.stringify({
      name: '@sovereign/bar', version: '0.2.3', type: 'module',
      exports: {'.': './src/index.js'},
      files: ['src/index.js'],
    }));
    writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog));
    return fn(dir);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

test('api-version: matches package.json + catalog', () => {
  withTempRepo(tmp => {
    const out = join(tmp, 'out.json');
    execFileSync('node', [SCRIPT, '--catalog', join(tmp, 'catalog.json'), '--out', out]);
    const report = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(report.summary.total, 2);
    assert.equal(report.summary.valid, 2);
    assert.equal(report.summary.invalid, 0);
    assert.equal(report.packages[0].policy, 'patch-only');
  });
});

test('api-version: detects version mismatch', () => {
  withTempRepo(tmp => {
    // Mutate one package to disagree with the catalog.
    const pkg = JSON.parse(readFileSync(join(tmp, 'pkg-foo', 'package.json'), 'utf8'));
    pkg.version = '0.1.1';
    writeFileSync(join(tmp, 'pkg-foo', 'package.json'), JSON.stringify(pkg));
    const out = join(tmp, 'out.json');
    // The script writes the report even when it returns non-zero, so we
    // do not depend on exit code — we read the report and assert.
    let code = 0;
    try {
      execFileSync('node', [SCRIPT, '--catalog', join(tmp, 'catalog.json'), '--out', out], {stdio: 'pipe'});
    } catch (e) { code = e.status ?? 1; }
    assert.notEqual(code, 0, 'script must exit non-zero on mismatch');
    const report = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(report.summary.invalid, 1);
    assert.match(report.packages[0].issues.join(' '), /version mismatch/);
  });
});