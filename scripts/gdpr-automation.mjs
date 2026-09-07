#!/usr/bin/env node
// scripts/gdpr-automation.mjs
//
// Aggregator for the four GDPR automation scripts.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '.hermes/phase3/gdpr');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const scripts = ['erasure', 'portability', 'consent', 'retention', 'scan'];
const summary = { started: new Date().toISOString(), runs: [] };
for (const s of scripts) {
  try {
    const stdout = execFileSync('node', [`privacy/gdpr-automation/scripts/${s}.mjs`], { cwd: REPO_ROOT, stdio: 'pipe', encoding: 'utf8' });
    summary.runs.push({ script: s, ok: true, output: stdout });
  } catch (err) {
    summary.runs.push({ script: s, ok: false, error: err.message });
  }
}
summary.finished = new Date().toISOString();
writeFileSync(join(OUT_DIR, 'gdpr-automation.summary.json'), JSON.stringify(summary, null, 2));
console.log(`gdpr-automation: ${summary.runs.filter(r => r.ok).length}/${scripts.length} ok`);