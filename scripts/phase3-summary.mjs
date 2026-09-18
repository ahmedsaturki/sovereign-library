#!/usr/bin/env node
// scripts/phase3-summary.mjs
//
// Aggregator for Phase-3 artifacts. Emits a JSON transcript that
// summarises: formal-verification, threat-model, static-analysis,
// zero-trust, gdpr, post-quantum, p2p.
//
// Usage:
//   node scripts/phase3-summary.mjs --out .hermes/phase3

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '.hermes/phase3');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const scripts = [
  ['formal-verify', 'scripts/formal-verify.mjs'],
  ['threat-model', 'scripts/threat-model.mjs'],
  ['static-analyse', 'scripts/static-analyse.mjs'],
  ['zero-trust-check', 'scripts/zero-trust-check.mjs'],
  ['gdpr-automation', 'scripts/gdpr-automation.mjs'],
  ['p2p-mesh-test', 'scripts/p2p-mesh-test.mjs'],
];

const summary = { started: new Date().toISOString(), runs: [] };
for (const [name, path] of scripts) {
  try {
    const stdout = execFileSync('node', [path], { cwd: REPO_ROOT, stdio: 'pipe', encoding: 'utf8' });
    summary.runs.push({ script: name, ok: true, output: stdout });
    console.log(`phase3: ${name} ok`);
  } catch (err) {
    summary.runs.push({ script: name, ok: false, error: err.message });
    console.error(`phase3: ${name} failed`);
  }
}
summary.finished = new Date().toISOString();
writeFileSync(join(OUT_DIR, 'phase3.summary.json'), JSON.stringify(summary, null, 2));
console.log(`phase3: ${summary.runs.filter(r => r.ok).length}/${scripts.length} ok`);