#!/usr/bin/env node
// scripts/api-version.mjs
// API version + semver contract evaluator for the package catalog.
//
// For each entry in scripts/package-catalog.json, read its package.json
// (resolved relative to the repo root) and validate that:
//   1. The declared version matches the catalog `version` field.
//   2. The declared semver satisfies the project's semver policy:
//      - 0.x packages: only 0.x.y (patch-only) is permitted by auto-merge.
//      - 1.x and above: minor (1.x.y) is permitted by auto-merge.
//
// This script is dependency-free and runs in plain Node. It writes a JSON
// report that the Phase-2 release-engineering workflow picks up.
//
// Usage:
//   node scripts/api-version.mjs \
//     --catalog scripts/package-catalog.json \
//     --out .hermes/phase2/api-version.json

import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname, join, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(v).trim());
  if (!m) return null;
  return {major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), raw: v};
}

function classifyAutoMergeEligible(ver) {
  if (!ver) return 'invalid';
  if (ver.major === 0) return 'patch-only';
  return 'minor-and-patch';
}

function loadPackageJson(dirEntry) {
  // Resolve relative dirs against the repo root (production) and
  // absolute dirs as-is (so tests with sandbox catalogs work).
  const pkgPath = isAbsolute(dirEntry)
    ? join(dirEntry, 'package.json')
    : join(REPO_ROOT, dirEntry, 'package.json');
  try {
    const raw = readFileSync(pkgPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {error: String(e.message || e), path: pkgPath};
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalogPath = resolve(REPO_ROOT, args.catalog ?? 'scripts/package-catalog.json');
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/api-version.json');
  mkdirSync(dirname(outPath), {recursive: true});

  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  // The catalog is an object keyed by source name; each value carries
  // {name, version, packageDir, expected, ...}. Normalize to an array.
  const entries = Array.isArray(catalog?.packages)
    ? catalog.packages
    : Object.entries(catalog).filter(([k, v]) => v && typeof v === 'object' && (v.name || v.packageDir)).map(([k, v]) => ({key: k, ...v}));

  const report = {
    schemaVersion: '1.0.0',
    catalogPath,
    generatedAt: new Date().toISOString(),
    policy: {
      autoMergeEligible: 'patch-only for 0.x; minor+patch for 1.x+',
      majorBumpRequiresHuman: true,
    },
    summary: {total: 0, valid: 0, invalid: 0, majorBump: 0, autoMergeEligible: 0},
    packages: [],
  };

  for (const entry of entries) {
      const pkgDir = entry.packageDir ?? entry.directory;
      if (!pkgDir) continue;
      const pkg = loadPackageJson(pkgDir);
    const version = parseSemver(pkg?.version);
    const catalogVersion = parseSemver(entry?.version);
    const policy = classifyAutoMergeEligible(version);
    const issues = [];
    if (!version) issues.push('missing or invalid package.json version');
    if (!catalogVersion) issues.push('missing or invalid catalog version');
    if (version && catalogVersion && version.raw !== catalogVersion.raw) {
      issues.push(`version mismatch: package.json=${version.raw} catalog=${catalogVersion.raw}`);
    }
    if (version && version.major > 0 && version.minor > 0 && version.patch === 0) {
      // First release of a new minor — typically a publish event, not
      // an auto-merge candidate.
      issues.push('first release of a minor — human review recommended');
    }
    report.summary.total++;
    if (issues.length === 0) report.summary.valid++;
    else report.summary.invalid++;
    if (version && version.major > 0) report.summary.majorBump++;
    if (policy === 'minor-and-patch' || (version && version.major === 0 && version.patch > 0)) {
      report.summary.autoMergeEligible++;
    }
    report.packages.push({
      name: entry.name ?? pkg?.name ?? '<unknown>',
      directory: pkgDir,
      declaredVersion: pkg?.version ?? null,
      catalogVersion: entry?.version ?? null,
      semver: version,
      policy,
      issues,
      exports: entry?.expected ?? entry?.exports ?? null,
    });
  }

  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  process.stdout.write(`api-version: ${report.summary.valid}/${report.summary.total} packages valid -> ${outPath}\n`);
  if (report.summary.invalid > 0) {
    process.exitCode = 1;
  }
}

main();