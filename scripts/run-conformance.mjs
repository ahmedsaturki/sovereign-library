// Conformance runner for Sovereign Library language-neutral contracts.
//
// Loads a canonical vector suite (contracts/conformance/vectors.<cube>.json) and
// executes it against a staged package implementation (packages/<cube>/src/index.js),
// proving the implementation satisfies the language-neutral contract exactly.
//
// This is the foundation for multi-ecosystem ports (Python / Kotlin-JVM / Android):
// a native implementation exposes the same callable surface and MUST satisfy the SAME
// vector file. The vectors are facts derived from real execution of the canonical Node
// implementation (see `derivedFrom` in each vector file). Do not edit expected outputs
// to make a port pass; fix the port.
//
// Usage:
//   node scripts/run-conformance.mjs <vectorFile> <packageDir>
//   node scripts/run-conformance.mjs --self <vectorFile>   # run against canonical Node pkg
//
// Exit code 0 = all vectors satisfied; 1 = any failure.

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

import { spawnSync } from 'node:child_process';

const ROOT = resolve('.');

function fail(message) {
  throw new Error(`[conformance] ${message}`);
}

function stage(candidateId, packageDir) {
  const res = spawnSync(process.execPath, [resolve(ROOT, 'scripts/package-stage.mjs'), candidateId], {
    cwd: ROOT,
    stdio: 'ignore',
    windowsHide: true,
  });
  if (res.status !== 0) fail(`staging ${candidateId} failed`);
  return packageDir;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function shapeCheck(value, requiredKeys) {
  if (!value || typeof value !== 'object') return `value is not an object`;
  const missing = requiredKeys.filter((k) => !(k in value));
  if (missing.length) return `missing keys: ${missing.join(',')}`;
  return null;
}

async function loadModule(packageDir) {
  const entry = resolve(packageDir, 'src/index.js');
  if (!existsSync(entry)) fail(`missing package entry: ${entry}`);
  return import(pathToFileURL(entry).href);
}

function getPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function resolveBindings(value, bindings) {
  if (typeof value === 'string' && value.startsWith('$')) {
    return getPath(bindings, value.slice(1));
  }
  if (Array.isArray(value)) return value.map((v) => resolveBindings(v, bindings));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = resolveBindings(value[k], bindings);
    return out;
  }
  return value;
}

function callExport(mod, callSpec, bindings) {
  const [name, args] = callSpec;
  const resolved = (args || []).map((a) => resolveBindings(a, bindings));
  const fn = mod[name];
  if (typeof fn === 'function') return fn(...resolved);
  // Constant export (frozen object/array/string). Read directly when no args expected.
  if (typeof fn !== 'undefined' && (!args || args.length === 0)) return fn;
  fail(`export not callable/accessible: ${name}`);
}

async function runVector(mod, vector) {
  const bindings = {};
  if (vector.setup) bindings.snapshot = callExport(mod, vector.setup.call, bindings);

  let subject = vector.call;
  if (vector.serializeFirst) {
    const serialized = callExport(mod, vector.serializeFirst.call, bindings);
    bindings.serialized = serialized;
    subject = vector.call;
  }

  const expect = vector.expect;
  try {
    const actual = callExport(mod, subject, bindings);
    if (expect.kind === 'throws') {
      return { ok: false, message: `expected throw ${expect.errorName} but returned value` };
    }
    if (expect.kind === 'value') {
      const actualPick = expect.pick ? deepEqualPick(actual, expect.pick) : deepEqual(actual, expect.value);
      if (!actualPick) {
        return { ok: false, message: `value mismatch\n  expected: ${JSON.stringify(expect.pick || expect.value)}\n  actual:   ${JSON.stringify(actual)}` };
      }
      if (expect.expectFailuresContains) {
        const failures = (actual && actual.failures) || [];
        const found = failures.some((f) => shapeCheck(f, Object.keys(expect.expectFailuresContains)) === null && deepEqualPick(f, expect.expectFailuresContains));
        if (!found) return { ok: false, message: `failures missing ${JSON.stringify(expect.expectFailuresContains)} in ${JSON.stringify(failures)}` };
      }
      return { ok: true };
    }
    if (expect.kind === 'shape') {
      const err = shapeCheck(actual, expect.requiredKeys);
      if (err) return { ok: false, message: err };
      return { ok: true };
    }
    return { ok: false, message: `unknown expectation kind: ${expect.kind}` };
  } catch (err) {
    if (expect.kind === 'throws') {
      if (expect.errorName && err.constructor.name !== expect.errorName) {
        return { ok: false, message: `threw ${err.constructor.name}, expected ${expect.errorName}` };
      }
      return { ok: true };
    }
    return { ok: false, message: `unexpected throw: ${err.constructor.name}: ${err.message}` };
  }
}

function deepEqualPick(a, pick) {
  return Object.keys(pick).every((k) => deepEqual(a[k], pick[k]));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) fail('usage: run-conformance.mjs <vectorFile> <packageDir> | --self <vectorFile>');

  let vectorFile;
  let packageDir;
  if (args[0] === '--self') {
    vectorFile = resolve(args[1]);
    const cube = vectorFile.match(/vectors\.([^/\\]+)\.json$/);
    if (!cube) fail('cannot infer cube id from --self vector file');
    const candidateId = cube[1];
    packageDir = stage(candidateId, resolve(ROOT, `packages/${candidateId}`));
  } else {
    vectorFile = resolve(args[0]);
    packageDir = resolve(args[1]);
    if (!existsSync(resolve(packageDir, 'src/index.js'))) {
      const candidateId = packageDir.split(/[\\/]/).pop();
      packageDir = stage(candidateId, packageDir);
    }
  }

  const suite = JSON.parse((await import('node:fs')).readFileSync(vectorFile, 'utf8'));
  const mod = await loadModule(packageDir);

  let passed = 0;
  let failed = 0;
  const failures = [];
  for (const vector of suite.vectors) {
    const r = await runVector(mod, vector);
    if (r.ok) {
      passed += 1;
      console.log(`  PASS  ${suite.contract} :: ${vector.id}`);
    } else {
      failed += 1;
      failures.push({ id: vector.id, message: r.message });
      console.log(`  FAIL  ${suite.contract} :: ${vector.id}\n        ${r.message}`);
    }
  }

  console.log(`\n[conformance] ${suite.contract} (${suite.format}): ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log(`[conformance] FAILED ${failures.length} vector(s)`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(`[conformance] ERROR: ${err.message}`);
  process.exit(1);
});
