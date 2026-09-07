#!/usr/bin/env node
// scripts/static-analyse.mjs
//
// Phase-3 / Continuity-Hardening Wave — custom static-analysis runner.
//
// Walks cubes/, products/, scripts/ and applies rules.mjs. Emits a
// SARIF v2.1.0 report and a JSON transcript under --out.
//
// Usage:
//   node scripts/static-analyse.mjs --out .hermes/phase3/static

import { parseArgsDefault as parseArgs } from './parse-args.mjs';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rules } from '../tests/static-analysis/custom-rules/rules.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const args = parseArgs(process.argv.slice(2));
const outDir = resolve(args.out ?? '.hermes/phase3/static');
const targets = (args.targets ?? 'cubes,products,scripts').split(',');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'test', 'tests', 'examples', '.hermes'].includes(entry.name)) continue;
      yield* walk(p);
    } else if (entry.isFile() && (p.endsWith('.js') || p.endsWith('.mjs'))) {
      yield p;
    }
  }
}

const findings = [];
const stats = { files: 0, byRule: {} };

for (const target of targets) {
  for (const file of walk(join(REPO_ROOT, target))) {
    const src = readFileSync(file, 'utf8');
    stats.files += 1;
    for (const rule of rules) {
      // Reset regex state
      rule.pattern.lastIndex = 0;
      // Apply per-rule exclude list.
      if (rule.exclude && rule.exclude.some(s => file.includes(s))) continue;
      let m;
      const re = new RegExp(rule.pattern.source, rule.pattern.flags + 'g');
      while ((m = re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split('\n').length;
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.message,
          file: relative(REPO_ROOT, file),
          line,
          snippet: m[0].slice(0, 80),
        });
        stats.byRule[rule.id] = (stats.byRule[rule.id] ?? 0) + 1;
      }
    }
  }
}

const sarif = {
  $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
  version: '2.1.0',
  runs: [{
    tool: {
      driver: {
        name: 'sovereign-static-analyzer',
        version: '0.1.0',
        rules: rules.map(r => ({
          id: r.id,
          shortDescription: { text: r.message },
          defaultConfiguration: { level: r.severity === 'blocker' || r.severity === 'critical' ? 'error' : 'warning' },
        })),
      },
    },
    results: findings.map(f => ({
      ruleId: f.ruleId,
      level: f.severity === 'blocker' || f.severity === 'critical' ? 'error' : 'warning',
      message: { text: `${f.message}: ${f.snippet}` },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: f.file },
          region: { startLine: f.line },
        },
      }],
    })),
  }],
};

writeFileSync(join(outDir, 'static-analysis.sarif'), JSON.stringify(sarif, null, 2));
writeFileSync(join(outDir, 'static-analysis.json'), JSON.stringify({ started: new Date().toISOString(), stats, findings }, null, 2));
console.log(`static-analyse: files=${stats.files} findings=${findings.length}`);
process.exit(findings.filter(f => f.severity === 'blocker' || f.severity === 'critical').length > 0 ? 1 : 0);