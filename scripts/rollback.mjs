#!/usr/bin/env node
// scripts/rollback.mjs
// Emit a deterministic rollback plan for a release. The plan lists the
// exact reverse steps and the state a rollback must restore (image tag,
// DB schema version, feature flags, traffic weight).
//
// Usage:
//   node scripts/rollback.mjs --manifest ci/deploy/manifest.json --out .hermes/phase2/rollback.json

import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = resolve(REPO_ROOT, args.manifest ?? 'ci/deploy/manifest.json');
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/rollback.json');
  mkdirSync(dirname(outPath), {recursive: true});
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const plan = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    manifest,
    triggers: [
      'error_rate > 1% sustained 5 minutes',
      'p99_latency > 2s sustained 5 minutes',
      'P0/P1 incident opened',
      'security regression detected post-deploy',
      'manual: on-call commander',
    ],
    steps: [
      {order: 1, action: 'freeze-traffic', detail: 'set canary weight to 0%; blue-green: revert traffic to previous color'},
      {order: 2, action: 'rollback-image',  detail: `restore image tag ${manifest.previousTag ?? '<previous-stable>'} from registry`},
      {order: 3, action: 'rollback-migrations', detail: 'apply reverse migrations from migrations/sqlite/*.down.sql in reverse order'},
      {order: 4, action: 'disable-feature-flags', detail: 'set every flag in rollback-disable list to false'},
      {order: 5, action: 'verify', detail: 'run scripts/perf-bench.mjs + scripts/chaos.mjs (smoke)'},
      {order: 6, action: 'open-incident', detail: 'open an Incident using templates/incident-response.md'},
      {order: 7, action: 'communicate', detail: 'notify #incidents and pinned status'},
    ],
    commands: {
      freezeTraffic: manifest.rollback?.freezeTraffic ?? 'kubectl patch svc sovereign --type merge -p \'{"spec":{"template":{"metadata":{"annotations":{"sovereign/canary-weight":"0"}}}}}\'',
      rollbackImage: manifest.rollback?.rollbackImage ?? 'kubectl set image deploy/sovereign sovereign=IMAGE_TAG',
      rollbackMigrations: 'node scripts/migrate.mjs --migrations migrations/sqlite --target "$DB_URL" --reverse',
    },
  };
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  process.stdout.write(`rollback: ${plan.steps.length} steps -> ${outPath}\n`);
}

main();