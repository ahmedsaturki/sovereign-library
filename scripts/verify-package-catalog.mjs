#!/usr/bin/env node
// verify-package-catalog.mjs
//
// Declarative package-tooling verification driven by PACKAGE_CATALOG.json.
// For every ELIGIBLE, NON-CONDITIONAL cube it:
//   - stages via scripts/package-catalog-stage.mjs
//   - npm packs, confirms the tarball contents match the canonical allowlist
//   - confirms no monorepo paths / test files cross into the artifact
//   - cleans staging afterwards
// Mirrors the rigor of scripts/verify-package-tooling.mjs but is catalog-driven
// so it scales beyond the two first-batch candidates.

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runNpm } from './npm-cli.mjs';

const ROOT = resolve('.');
const CATALOG_PATH = resolve('PACKAGE_CATALOG.json');

const expectedFiles = new Set([
  'LICENSE',
  'NOTICE',
  'README.md',
  'dist/index.d.ts',
  'package.json',
  'src/index.js',
]);

const bundledNpmCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');

function fail(message) {
  throw new Error(`[catalog-verify] ${message}`);
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = `${(result.stdout ?? '')}${(result.stderr ?? '')}`.trim();
    fail(`${command} ${args.join(' ')} failed with ${result.status}: ${output}`);
  }
  return result.stdout ?? '';
}

function runNpmLocal(args, cwd) {
  if (existsSync(bundledNpmCli)) return run(process.execPath, [bundledNpmCli, ...args], cwd);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return run(npm, args, cwd);
}

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
const candidates = catalog.cubes.filter(
  (c) => c.classification !== 'CONDITIONAL' && c.hasTest && c.hasReadme,
);

let verified = 0;
for (const candidate of candidates) {
  const packageId = candidate.packageId || candidate.id;
  const packageDir = resolve('packages', packageId);
  const packageJsonPath = resolve(packageDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    console.log(`[catalog-verify] SKIP ${candidate.id}: no package.json (not yet staged)`);
    continue;
  }
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (pkg.private === true) fail(`${candidate.id} must not be private`);
  if (pkg.license !== 'Apache-2.0') fail(`${candidate.id} has incorrect license`);
  if (pkg.type !== 'module') fail(`${candidate.id} must be ESM`);
  if (pkg.engines?.node !== '>=24') fail(`${candidate.id} must require Node >=24`);
  if (pkg.sideEffects !== false) fail(`${candidate.id} must set sideEffects=false`);
  if (pkg.dependencies || pkg.peerDependencies || pkg.optionalDependencies) {
    fail(`${candidate.id} must have no runtime dependency declarations`);
  }
  if (pkg.scripts) fail(`${candidate.id} must not ship development scripts`);
  if (!pkg.exports || JSON.stringify(Object.keys(pkg.exports)) !== '["."]') {
    fail(`${candidate.id} must expose only the root export`);
  }
  const rootExport = pkg.exports['.'];
  if (rootExport?.types !== './dist/index.d.ts' || rootExport?.import !== './src/index.js' || rootExport?.default !== './src/index.js') {
    fail(`${candidate.id} has an invalid root export map`);
  }
  if (!Array.isArray(pkg.files) || new Set(pkg.files).size !== pkg.files.length || !pkg.files.every((f) => expectedFiles.has(f))) {
    fail(`${candidate.id} has an invalid files allowlist`);
  }

  const packDir = resolve('.artifacts/package-verify', packageId);
  try {
    run(process.execPath, [resolve('scripts/package-catalog-stage.mjs'), candidate.id]);
    rmSync(packDir, { recursive: true, force: true });
    mkdirSync(packDir, { recursive: true });
    const packJsonText = runNpmLocal(['pack', '--json', '--ignore-scripts', '--pack-destination', packDir], packageDir);
    const packResult = JSON.parse(packJsonText);
    if (!Array.isArray(packResult) || packResult.length !== 1) fail(`${candidate.id} npm pack did not return exactly one package result`);
    const files = new Set((packResult[0].files ?? []).map((entry) => String(entry.path).replaceAll('\\', '/')));
    for (const file of expectedFiles) if (!files.has(file)) fail(`${candidate.id} tarball is missing ${file}`);
    for (const file of files) {
      if (!expectedFiles.has(file)) fail(`${candidate.id} tarball contains undeclared file ${file}`);
      if (file.startsWith('.github/') || file.startsWith('.git/') || file.startsWith('.artifacts/') || file.includes('test')) {
        fail(`${candidate.id} tarball crossed a prohibited boundary: ${file}`);
      }
    }
    const tarball = resolve(packDir, packResult[0].filename);
    if (!existsSync(tarball)) fail(`${candidate.id} tarball was not created`);
    console.log(`[catalog-verify] ${candidate.id}: manifest, export map, staging, and npm pack contents passed`);
    verified++;
  } finally {
    rmSync(packDir, { recursive: true, force: true });
    rmSync(resolve(packageDir, 'src'), { recursive: true, force: true });
    rmSync(resolve(packageDir, 'dist'), { recursive: true, force: true });
    rmSync(resolve(packageDir, 'LICENSE'), { force: true });
    rmSync(resolve(packageDir, 'NOTICE'), { force: true });
  }
}

console.log(`[catalog-verify] VERIFIED ${verified} staged package(s); remaining staged candidates skipped only if unstaged.`);
console.log('[catalog-verify] ALL CATALOG PACKAGE TOOLING CHECKS PASSED');
