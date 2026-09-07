#!/usr/bin/env node
// scripts/phase2-summary.mjs
// Aggregate every Phase-2 artifact path into a single JSON index for
// downstream consumers (release notes generation, audit, evidence
// collection).
//
// Usage:
//   node scripts/phase2-summary.mjs \
//     --run-id 12345 --sha abcdef --ref refs/heads/main --event push \
//     --out .hermes/phase2/summary.json

import {writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    runId: args['run-id'] ?? null,
    sha: args.sha ?? null,
    ref: args.ref ?? null,
    event: args.event ?? null,
    artifacts: {
      multiRegionCi: '.hermes/phase2/ci-region-*/*.txt',
      perfRegression: '.hermes/phase2/perf-*.diff.json',
      e2eCloud: '.hermes/phase2/e2e-*.json',
      chaos: '.hermes/phase2/chaos.json',
      fossaLicense: '.hermes/phase2/fossa-licenses.sarif',
      sbomRelease: '.hermes/phase2/release-node-sbom.spdx.json',
      sbomDigest: '.hermes/phase2/sbom-digest.json',
      apiVersion: '.hermes/phase2/api-version.json',
      backcompat: '.hermes/phase2/backcompat.json',
      featureFlags: '.hermes/phase2/feature-flags.json',
      deployPlan: '.hermes/phase2/deploy-plan.json',
      rollback: '.hermes/phase2/rollback.json',
      changelog: '.hermes/phase2/changelog.md',
      releaseNotes: '.hermes/phase2/release-notes.md',
      migrations: '.hermes/phase2/migrations.json',
    },
    workflows: {
      releaseEngineering: '.github/workflows/release-engineering.yml',
      dependabotAutoMerge: '.github/dependabot-auto-merge.yml',
      securityPipeline: '.github/workflows/security-pipeline.yml',
      verify: '.github/workflows/verify.yml',
    },
    phase2Capabilities: [
      'multi-region-ci',
      'e2e-cloud',
      'perf-regression',
      'chaos',
      'load-k6',
      'load-locust',
      'fossa-license',
      'sbom-release',
      'sbom-digest',
      'image-signing',
      'dast-zap',
      'api-version',
      'backcompat',
      'feature-flags',
      'deploy-plan',
      'rollback',
      'changelog',
      'release-notes',
      'migrations',
      'dependabot-auto-merge',
    ],
  };
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/summary.json');
  mkdirSync(dirname(outPath), {recursive: true});
  writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  process.stdout.write(`phase2-summary: 20 capabilities indexed -> ${outPath}\n`);
}

main();