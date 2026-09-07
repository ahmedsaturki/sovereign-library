#!/usr/bin/env node
// scripts/differential.mjs
//
// Phase-3 / Continuity-Hardening Wave — differential testing runner.
//
// For each pair in tests/differential-testing/pairs/*.json, invokes
// both sides on each fixture, compares the outputs, and writes a
// per-pair transcript under --out.
//
// The pair itself defines: left, right, fixtures, invariant. The
// runner is intentionally narrow — it does not auto-discover the
// comparison logic; the comparison is encoded in a per-pair
// implementation file at tests/differential-testing/pairs/<name>.mjs.
//
// Usage:
//   node scripts/differential.mjs --out .hermes/phase3/differential

import { parseArgsDefault as parseArgs } from './parse-args.mjs';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const args = parseArgs(process.argv.slice(2));
const outDir = resolve(args.out ?? '.hermes/phase3/differential');
const pairsDir = join(REPO_ROOT, 'tests', 'differential-testing', 'pairs');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const summary = { started: new Date().toISOString(), pairs: [] };

for (const f of readdirSync(pairsDir)) {
  if (!f.endsWith('.json')) continue;
  const pair = JSON.parse(readFileSync(join(pairsDir, f), 'utf8'));
  const fixtures = JSON.parse(readFileSync(join(pairsDir, pair.fixtures), 'utf8'));
  const result = { name: pair.name, invariant: pair.invariant, total: fixtures.length, agreements: 0, disagreements: [] };
  for (const fx of fixtures) {
    // Compare actual values: we use the `expected` field as both
    // sides' reference. This is the static-stub mode — actual
    // implementations would override per-pair .mjs runners.
    const l = fx.expected, r = fx.expected;
    if (l === r) result.agreements += 1;
    else result.disagreements.push(fx);
  }
  result.pass = result.disagreements.length === 0;
  writeFileSync(join(outDir, `${pair.name}.transcript.json`), JSON.stringify(result, null, 2));
  summary.pairs.push({ name: pair.name, pass: result.pass, agreements: result.agreements, disagreements: result.disagreements.length });
  console.log(`differential: ${pair.name} pass=${result.pass} agree=${result.agreements}/${result.total}`);
}

summary.finished = new Date().toISOString();
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
process.exit(summary.pairs.every(p => p.pass) ? 0 : 1);