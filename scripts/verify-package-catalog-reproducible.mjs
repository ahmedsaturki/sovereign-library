#!/usr/bin/env node
// verify-package-catalog-reproducible.mjs
//
// Declarative reproducible-packaging verification driven by PACKAGE_CATALOG.json.
// For every ELIGIBLE, NON-CONDITIONAL cube that has a staged package.json it:
//   - stages twice via scripts/package-catalog-stage.mjs
//   - npm packs twice
//   - asserts byte-identical tarballs, integrity, shasum, and file manifests
// Mirrors scripts/verify-reproducible-package.mjs but is catalog-driven.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runNpm } from './npm-cli.mjs';

const ROOT = resolve('.');
const OUT = resolve('.artifacts/reproducible-package');
const CATALOG_PATH = resolve('PACKAGE_CATALOG.json');

function fail(message) {
  throw new Error(`[catalog-repro-verify] ${message}`);
}
function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
function packOnce(candidate, destination) {
  const packageId = candidate.packageId || candidate.id;
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  const result = runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', destination], {
    cwd: resolve(ROOT, 'packages', packageId),
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (result.status !== 0) fail(`${candidate.id} npm pack failed with ${result.status}`);
  const parsed = JSON.parse(result.stdout ?? '');
  if (!Array.isArray(parsed) || parsed.length !== 1) fail(`${candidate.id} npm pack did not return exactly one result`);
  const meta = parsed[0];
  const tarball = resolve(destination, meta.filename);
  if (!existsSync(tarball)) fail(`${candidate.id} tarball missing: ${tarball}`);
  return { tarball, integrity: meta.integrity ?? null, shasum: meta.shasum ?? null, files: (meta.files ?? []).map(({ path, size }) => ({ path, size })), bytes: readFileSync(tarball) };
}

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
const candidates = catalog.cubes.filter(
  (c) => c.classification !== 'CONDITIONAL' && c.hasTest && c.hasReadme && existsSync(resolve('packages', (c.packageId || c.id), 'package.json')),
);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let checked = 0;
try {
  for (const candidate of candidates) {
    const packageId = candidate.packageId || candidate.id;
    const firstDir = resolve(OUT, packageId, 'first');
    const secondDir = resolve(OUT, packageId, 'second');
    const s1 = spawnSync(process.execPath, [resolve(ROOT, 'scripts/package-catalog-stage.mjs'), candidate.id], { stdio: 'inherit', shell: false });
    if (s1.status !== 0) fail(`${candidate.id} first staging failed`);
    const first = packOnce(candidate, firstDir);
    const s2 = spawnSync(process.execPath, [resolve(ROOT, 'scripts/package-catalog-stage.mjs'), candidate.id], { stdio: 'inherit', shell: false });
    if (s2.status !== 0) fail(`${candidate.id} second staging failed`);
    const second = packOnce(candidate, secondDir);
    if (!first.bytes.equals(second.bytes)) fail(`${candidate.id} tarball bytes are not reproducible: sha256 ${sha256(first.tarball)} != ${sha256(second.tarball)}`);
    if (first.integrity !== second.integrity) fail(`${candidate.id} integrity changed between identical packs`);
    if (first.shasum !== second.shasum) fail(`${candidate.id} shasum changed between identical packs`);
    if (JSON.stringify(first.files) !== JSON.stringify(second.files)) fail(`${candidate.id} packaged file manifest changed`);
    console.log(`[catalog-repro-verify] ${candidate.id}: byte-identical tarball, integrity, shasum, and file manifest`);
    checked++;
  }
  console.log(`[catalog-repro-verify] ALL REPRODUCIBILITY CHECKS PASSED (${checked} staged package[s])`);
} finally {
  for (const candidate of candidates) {
    const cleanupId = candidate.packageId || candidate.id;
    rmSync(resolve(ROOT, 'packages', cleanupId, 'src'), { recursive: true, force: true });
    rmSync(resolve(ROOT, 'packages', cleanupId, 'dist'), { recursive: true, force: true });
    rmSync(resolve(ROOT, 'packages', cleanupId, 'LICENSE'), { force: true });
    rmSync(resolve(ROOT, 'packages', cleanupId, 'NOTICE'), { force: true });
  }
  rmSync(OUT, { recursive: true, force: true });
}
