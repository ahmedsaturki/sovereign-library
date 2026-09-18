#!/usr/bin/env node
// scripts/deploy-plan.mjs
// Emit a deterministic deployment plan for a release. Strategies:
//   - canary         (sequential percentage ramp: 1% -> 10% -> 50% -> 100%)
//   - progressive    (linear ramp: 5% every 5 minutes until 100%)
//   - blue-green     (atomic swap; full traffic moves to new stack)
//
// Output: ci/plan.json — a record that downstream automation can act on.
//
// Usage:
//   node scripts/deploy-plan.mjs --strategy canary --manifest ci/deploy/manifest.json --out .hermes/phase2/deploy-plan.json

import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

const STRATEGIES = {
  canary: [
    {step: 1,  percent: 1,   holdSeconds: 60,  abortOn: ['error_rate>1%', 'p99_latency>2s']},
    {step: 2,  percent: 10,  holdSeconds: 300, abortOn: ['error_rate>1%', 'p99_latency>2s']},
    {step: 3,  percent: 50,  holdSeconds: 600, abortOn: ['error_rate>0.5%', 'p99_latency>1.5s']},
    {step: 4,  percent: 100, holdSeconds: 0,   abortOn: []},
  ],
  progressive: Array.from({length: 20}, (_, i) => ({
    step: i + 1,
    percent: Math.min(100, (i + 1) * 5),
    holdSeconds: 300,
    abortOn: ['error_rate>1%', 'p99_latency>2s'],
  })),
  'blue-green': [
    {step: 1, percent: 0,   holdSeconds: 0,   action: 'spin-up-green', abortOn: []},
    {step: 2, percent: 100, holdSeconds: 60,  action: 'switch-traffic', abortOn: ['error_rate>1%']},
    {step: 3, percent: 100, holdSeconds: 0,   action: 'decommission-blue', abortOn: []},
  ],
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const strategy = args.strategy ?? 'canary';
  const manifestPath = resolve(REPO_ROOT, args.manifest ?? 'ci/deploy/manifest.json');
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/deploy-plan.json');
  mkdirSync(dirname(outPath), {recursive: true});

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const steps = STRATEGIES[strategy];
  if (!steps) {
    process.stderr.write(`Unknown strategy: ${strategy}\n`);
    process.exit(2);
  }
  const plan = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    strategy,
    manifest,
    steps: steps.map(s => ({
      ...s,
      preconditions: ['required CI green', 'security-pipeline green', 'no P0 incidents'],
      rollbackTrigger: 'any abortOn condition OR P0 incident OR manual',
    })),
    rollback: {script: 'scripts/rollback.mjs', manifest: manifestPath},
  };
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  process.stdout.write(`deploy-plan: strategy=${strategy} steps=${plan.steps.length} -> ${outPath}\n`);
}

main();