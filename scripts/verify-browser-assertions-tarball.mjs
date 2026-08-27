// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
// @ts-check
//
// Tarball-level package independence verification for @sovereign/browser-assertions.
//
// Simulates: build/package -> npm pack -> extract tarball -> use OUTSIDE the
// monorepo source layout -> execute the public API. Proves the artifact does
// NOT depend on cubes/ or any monorepo-relative source path after extraction.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const PKG_DIR = resolve('cubes/browser-assertions');
const failures = [];
function fail(msg) { failures.push(msg); console.error('[tarball] FAIL: ' + msg); }
function ok(msg) { console.log('[tarball] ok: ' + msg); }

// Resolve npm execution cross-platform. CI runners (ubuntu/macos/windows) all
// expose `npm` on PATH. Locally on Windows git-bash, execFileSync may need the
// .cmd wrapper via `cmd /c`. We probe both forms defensively.
function runNpm(args, cwd) {
  const attempts = [
    { cmd: 'npm', a: args },
    { cmd: 'npm.cmd', a: args },
    { cmd: 'cmd', a: ['/c', 'npm', ...args] },
  ];
  let lastErr;
  for (const attempt of attempts) {
    try {
      return execFileSync(attempt.cmd, attempt.a, { cwd, encoding: 'utf8' });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// 1. npm pack
let tarball;
try {
  const out = runNpm(['pack', '--silent'], PKG_DIR);
  tarball = join(PKG_DIR, out.trim().split('\n').pop());
  ok('npm pack produced ' + tarball.split(/[\\/]/).pop());
} catch (e) {
  fail('npm pack failed: ' + e.message);
  process.exit(1);
}

// 2. extract to a neutral temp dir OUTSIDE the repo (pure-Node, no external tar)
const extractDir = mkdtempSync(join(tmpdir(), 'sov-ba-tarball-'));

function extractTarball(tgzPath, destDir) {
  const buf = readFileSync(tgzPath);
  const gz = gunzipSync(buf);
  // Minimal portable tar parser (ustar/gnu), enough for npm pack output.
  let offset = 0;
  while (offset + 512 <= gz.length) {
    const header = gz.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    if (!name) break;
    const sizeStr = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = parseInt(sizeStr || '0', 8) || 0;
    offset += 512;
    if (size > 0) {
      const data = gz.subarray(offset, offset + size);
      const outPath = join(destDir, name);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, data);
      offset += Math.ceil(size / 512) * 512;
    }
  }
}

if (!existsSync(extractDir)) mkdirSync(extractDir, { recursive: true });
try {
  extractTarball(tarball, extractDir);
  ok('tarball extracted to ' + extractDir);
} catch (e) {
  fail('tarball extract failed: ' + e.message);
  cleanup();
  process.exit(1);
}

const pkgRoot = join(extractDir, 'package');
const srcEntry = join(pkgRoot, 'src/index.js');

// 3. no monorepo-relative imports may survive in the artifact
if (!existsSync(srcEntry)) { fail('package entry src/index.js missing in tarball'); cleanup(); process.exit(1); }
const srcText = readFileSync(srcEntry, 'utf8');
const srcLines = srcText.split('\n');
// Only flag REAL import/export-from statements, never mention-in-comments.
const parentImports = srcLines.filter(l => /^\s*(import|export)\b.*\bfrom\s*['"]\.\.\//.test(l));
const canonicalRef = srcLines.filter(l => /^\s*import\b.*\bfrom\s*['"][^'"]*canonical-json/.test(l));
if (parentImports.length) {
  fail('tarball src still contains relative parent imports: ' + parentImports.join(' | '));
} else {
  ok('no ../../ parent imports in packaged src (package-independent)');
}
if (canonicalRef.length) {
  fail('tarball still imports canonical-json by monorepo path: ' + canonicalRef.join(' | '));
} else {
  ok('no canonical-json monorepo-path import in packaged src');
}
// No runtime dependency on monorepo directories outside its own artifact.
// Only consider import/require statements, not prose/comments.
const depImports = srcLines.filter(l => /^\s*(import|export)\b.*\bfrom\s*['"]|^\s*(import|require)\s*\(?\s*['"]/.test(l));
const badDeps = depImports.filter(l => /(^|[^.\w])(\.\.\/){2,}|[\\/](cubes|packages)[\\/]/.test(l));
if (badDeps.length) {
  fail('tarball src references cubes/ or packages/ or deep parent paths: ' + badDeps.join(' | '));
} else {
  ok('no cubes/ or packages/ or deep-parent path dependency in artifact');
}

// 4. execute the public API out-of-tree (no access to repo cubes/)
try {
  const consumer = join(extractDir, 'consumer.mjs');
  writeFileSync(consumer, `
    import { expect, Snapshot, AssertionsError } from ${JSON.stringify(pathToFileURL(join(pkgRoot, 'src/index.js')).href)};
    // canonicalization works without the monorepo
    const s = new Snapshot();
    const a = s.capture('<div>x</div>');
    if (a.stable !== '{"html":"<div>x</div>"}') throw new Error('canonicalization wrong: ' + a.stable);
    // Snapshot.diff works out-of-tree
    const d = s.diff('<div>x</div>', '<div>y</div>');
    if (d.equal !== false) throw new Error('diff should detect difference');
    const same = s.diff('<div>x</div>', '<div>x</div>');
    if (same.equal !== true) throw new Error('diff should equal identical');
    // representative error case: non-string input -> INVALID_SNAPSHOT (non-retryable)
    let threw = false;
    try { s.capture(123); } catch (e) { threw = e instanceof AssertionsError && e.code === 'INVALID_SNAPSHOT' && e.retryable === false; }
    if (!threw) throw new Error('non-string snapshot must throw INVALID_SNAPSHOT');
    // assertions API + error types load
    if (typeof expect !== 'function') throw new Error('expect missing');
    if (typeof AssertionsError !== 'function') throw new Error('AssertionsError missing');
    // immutability
    if (!Object.isFrozen(a)) throw new Error('snapshot not frozen');
    // error taxonomy frozen
    const e = new AssertionsError('X', 'm', { retryable: true });
    if (e.code !== 'X' || e.retryable !== true || !Object.isFrozen(e)) throw new Error('error taxonomy wrong');
    console.log('CONSUMER_OK');
  `);
  const res = execFileSync(process.execPath, [consumer], { encoding: 'utf8' });
  if (!res.includes('CONSUMER_OK')) { fail('consumer run did not report success: ' + res); }
  else ok('packaged API executes out-of-tree (canonicalization, diff, error contract, assertions, immutability)');
} catch (e) {
  fail('out-of-tree consumer execution failed: ' + e.message + (e.stderr ? '\n' + e.stderr : ''));
}

function cleanup() {
  try { rmSync(extractDir, { recursive: true, force: true }); } catch {}
  try { rmSync(tarball, { force: true }); } catch {}
}
cleanup();

if (failures.length) {
  console.error(`\n[tarball] ${failures.length} FAILURE(S)`);
  process.exit(1);
}
console.log('\n[tarball] ALL PACKAGE-INDEPENDENCE CHECKS PASSED');
