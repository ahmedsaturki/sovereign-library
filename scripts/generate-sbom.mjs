#!/usr/bin/env node
// scripts/generate-sbom.mjs
// Generate a normalized SBOM-style digest for every package in the
// catalog. The output is JSON with one row per package:
//   { name, version, directory, files: [...], sha256: '...' }
//
// The `files` list is sourced from each package's `files` allowlist (or
// the actual file list when the allowlist is absent). The `sha256` is
// computed over the canonical concatenation of `file:content` lines in
// deterministic order — this is reproducible across runs because the
// hash is over the files explicitly listed by the package.
//
// For full SPDX/CycloneDX generation, the release-engineering workflow
// uses anchore/sbom-action (SPDX) and cyclonedx-bom (CycloneDX). This
// script produces a compact, deterministic companion artifact suitable
// for embedding in release notes and as a quick integrity check.
//
// Usage:
//   node scripts/generate-sbom.mjs --input scripts/package-catalog.json --out .hermes/phase2/sbom-digest.json

import {readFileSync, readdirSync, writeFileSync, mkdirSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, dirname, join, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

function listPackageFiles(pkgDir, allowlist) {
  if (Array.isArray(allowlist) && allowlist.length) {
    return allowlist.map(f => join(pkgDir, f)).filter(p => {
      try { return statSync(p).isFile(); } catch { return false; }
    });
  }
  // Fallback: list every regular file directly under the package dir,
  // excluding common noise.
  const noise = new Set(['node_modules', '.git', 'coverage', 'dist']);
  const out = [];
  function walk(dir) {
    for (const ent of readdirSync(dir, {withFileTypes: true})) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (noise.has(ent.name)) continue;
        walk(full);
      } else if (ent.isFile()) {
        out.push(full);
      }
    }
  }
  try { walk(pkgDir); } catch {}
  return out.sort();
}

function sha256OfFiles(files) {
  const h = createHash('sha256');
  for (const f of files) {
    const rel = relative(REPO_ROOT, f).replace(/\\/g, '/');
    h.update(`file:${rel}\n`);
    h.update(readFileSync(f));
    h.update('\n');
  }
  return h.digest('hex');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalogPath = resolve(REPO_ROOT, args.input ?? 'scripts/package-catalog.json');
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/sbom-digest.json');
  mkdirSync(dirname(outPath), {recursive: true});
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
    const entries = Array.isArray(catalog?.packages)
      ? catalog.packages
      : Object.entries(catalog).filter(([k, v]) => v && typeof v === 'object' && (v.name || v.packageDir)).map(([k, v]) => ({key: k, ...v}));

    const rows = [];
      for (const entry of entries) {
        const pkgRelDir = entry.packageDir ?? entry.directory;
        if (!pkgRelDir) continue;
        const pkgDir = isAbsolute(pkgRelDir) ? pkgRelDir : resolve(REPO_ROOT, pkgRelDir);
        let pkg = {};
        try { pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')); } catch {}
        const files = listPackageFiles(pkgDir, pkg.files);
        const sha256 = files.length ? sha256OfFiles(files) : null;
        rows.push({
          name: pkg.name ?? entry.name,
          version: pkg.version ?? entry.version,
          directory: pkgRelDir,
          fileCount: files.length,
          files: files.map(f => relative(pkgDir, f).replace(/\\/g, '/')),
          sha256,
        });
      }

  const sbom = {
    schemaVersion: '1.0.0',
    spdxVersion: 'SPDX-2.3',
    generatedAt: new Date().toISOString(),
    generator: 'sovereign-sbom-digest-1.0.0',
    rootCatalog: catalogPath,
    packageCount: rows.length,
    packages: rows,
  };
  writeFileSync(outPath, JSON.stringify(sbom, null, 2) + '\n', 'utf8');
  process.stdout.write(`generate-sbom: ${rows.length} packages -> ${outPath}\n`);
}

main();