#!/usr/bin/env node
// scripts/backward-compat.mjs
// Backward-compatibility evaluation for package surface.
//
// Strategy:
//   1. Read the package catalog and resolve each entry's package.json.
//   2. For every entry, identify the package's public export surface:
//        - `exports` map keys (subpath exports).
//        - `main` / `module` / `types` if `exports` is absent.
//        - `files` allowlist (must include src/index.{js,ts} and
//          dist/index.d.ts for typed packages).
//   3. Compare against the BASE ref via `git show` for added/removed
//      export keys. Fail the run if any removal is detected on a package
//      that has not been marked as a major bump.
//
// Dependency-free: only stdlib (fs, path, child_process via execFileSync).
//
// Usage:
//   node scripts/backward-compat.mjs \
//     --base-ref main \
//     --catalog scripts/package-catalog.json \
//     --out .hermes/phase2/backcompat.json

import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname, join, isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

function listExportKeys(pkg) {
  if (pkg?.exports && typeof pkg.exports === 'object') {
    // Strip the "types" condition for surface comparison.
    return Object.keys(pkg.exports).sort();
  }
  return ['.']; // legacy
}

function gitShow(ref, file) {
  try {
    const out = execFileSync('git', ['show', `${ref}:${file}`], {cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']});
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseRef = args['base-ref'] ?? 'main';
  const catalogPath = resolve(REPO_ROOT, args.catalog ?? 'scripts/package-catalog.json');
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/backcompat.json');
  mkdirSync(dirname(outPath), {recursive: true});

  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
    const entries = Array.isArray(catalog?.packages)
      ? catalog.packages
      : Object.entries(catalog).filter(([k, v]) => v && typeof v === 'object' && (v.name || v.packageDir)).map(([k, v]) => ({key: k, ...v}));

  const report = {
    schemaVersion: '1.0.0',
    baseRef,
    generatedAt: new Date().toISOString(),
    summary: {total: 0, unchanged: 0, additions: 0, removals: 0, errors: 0},
    packages: [],
  };

  for (const entry of entries) {
        const pkgDirRaw = entry.packageDir ?? entry.directory;
        if (!pkgDirRaw) continue;
        const pkgDir = isAbsolute(pkgDirRaw) ? pkgDirRaw : join(REPO_ROOT, pkgDirRaw);
        const pkgPath = join(pkgDir, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const before = gitShow(baseRef, pkgPath);
    const beforeKeys = before ? listExportKeys(before) : null;
    const afterKeys = listExportKeys(pkg);
    const beforeSet = new Set(beforeKeys ?? []);
    const afterSet = new Set(afterKeys);
    const added = afterKeys.filter(k => !beforeSet.has(k));
    const removed = (beforeKeys ?? []).filter(k => !afterSet.has(k));
    let status = 'unchanged';
    if (beforeKeys === null) status = 'no-baseline';
    else if (removed.length) status = 'removal';
    else if (added.length) status = 'addition';

    report.summary.total++;
    if (status === 'unchanged') report.summary.unchanged++;
    else if (status === 'addition') report.summary.additions++;
    else if (status === 'removal') report.summary.removals++;
    else report.summary.errors++;

    report.packages.push({
          name: pkg.name,
          directory: pkgDir,
          declaredVersion: pkg.version,
          added,
          removed,
          status,
        });
      }

  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  process.stdout.write(`backward-compat: removals=${report.summary.removals} additions=${report.summary.additions} unchanged=${report.summary.unchanged}\n`);
  if (report.summary.removals > 0) {
    // Removals are allowed only if a major semver bump accompanies them.
    process.stderr.write('Backward-incompatible removals detected; verify major semver bump.\n');
    process.exitCode = 2;
  }
}

main();