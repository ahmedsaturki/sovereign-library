#!/usr/bin/env node
// scripts/threat-model.mjs
//
// Phase-3 / Continuity-Hardening Wave — threat-modelling runner.
//
// Reads registry.json, parses the YAML files, and emits one Markdown
// report per cube under security/threat-modeling/reports/.
//
// YAML parsing is intentionally minimal — it only handles the
// structure used by stride/<cube>.yaml and pasta/<cube>.yaml
// files. A full YAML parser would break the dependency-free
// contract.
//
// Usage:
//   node scripts/threat-model.mjs --out security/threat-modeling/reports

import { parseArgsDefault as parseArgs } from './parse-args.mjs';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const args = parseArgs(process.argv.slice(2));
const outDir = resolve(args.out ?? join(REPO_ROOT, 'security', 'threat-modeling', 'reports'));
const registryPath = resolve(join(REPO_ROOT, 'security', 'threat-modeling', 'registry.json'));

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));

function pseudoYaml(src) {
  // Naive YAML parser: top-level scalars, lists `-`, and 2-space
  // indented key:value maps under `threats`. Sufficient for our DSL.
  const lines = src.split(/\r?\n/);
  const out = { top: [], threats: [] };
  let mode = null;
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (line.startsWith('  - ') || line.startsWith('    - ')) {
      // List item under a sub-list (we collapse into a marker)
      out.threats.push({ name: line.trim().slice(2) });
      mode = 'list';
    } else if (line.startsWith('  ')) {
      if (out.threats.length === 0) out.threats.push({});
      const last = out.threats[out.threats.length - 1];
      const m = /^  (\w[\w_-]*):\s*(.*)$/.exec(line);
      if (m) last[m[1]] = m[2];
    } else {
      const m = /^(\w[\w_-]*):\s*(.*)$/.exec(line);
      if (m) out.top[m[1]] = m[2];
    }
  }
  return out;
}

function renderStride(name, parsed) {
  const threats = parsed.threats ?? [];
  const lines = [
    `# STRIDE — ${name}`,
    ``,
    `**Cube:** ${name}`,
    `**Last reviewed:** ${parsed.top.last_review ?? 'unknown'}`,
    `**Reviewer:** ${parsed.top.reviewer ?? 'unknown'}`,
    ``,
    `## Threats`,
    ``,
    `| # | Category | Threat | Mitigation | Status |`,
    `|---|----------|--------|------------|--------|`,
  ];
  threats.forEach((t, i) => {
    const cat = (t.name ?? '').split(' — ')[0] ?? '';
    const thr = (t.name ?? '').split(' — ')[1] ?? '';
    lines.push(`| ${i + 1} | ${cat} | ${thr} | ${t.mitigation ?? '—'} | ${t.status ?? '—'} |`);
  });
  return lines.join('\n') + '\n';
}

function renderPasta(name, parsed) {
  return [
    `# PASTA — ${name}`,
    ``,
    `**Cube:** ${name}`,
    `**Last reviewed:** ${parsed.top.last_review ?? 'unknown'}`,
    ``,
    `## Business objective`,
    parsed.top.business_objective ?? '—',
    ``,
    `## Technical scope`,
    parsed.top.technical_scope ?? '—',
    ``,
    `## Threats`,
    JSON.stringify(parsed.threats, null, 2),
    ``,
    `## Residual risk`,
    parsed.top.residual_risk ?? 'unknown',
    ``,
  ].join('\n');
}

let written = 0;
for (const cube of registry) {
  if (cube.stride) {
    const src = readFileSync(join(REPO_ROOT, 'security', 'threat-modeling', cube.stride), 'utf8');
    const parsed = pseudoYaml(src);
    writeFileSync(join(outDir, `${cube.name}.stride.md`), renderStride(cube.name, parsed));
    written += 1;
  }
  if (cube.pasta) {
    const src = readFileSync(join(REPO_ROOT, 'security', 'threat-modeling', cube.pasta), 'utf8');
    const parsed = pseudoYaml(src);
    writeFileSync(join(outDir, `${cube.name}.pasta.md`), renderPasta(cube.name, parsed));
    written += 1;
  }
}
console.log(`threat-model: ${written} reports written to ${outDir}`);