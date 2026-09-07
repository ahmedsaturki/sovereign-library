#!/usr/bin/env node
// scripts/perf-compare.mjs
// Compare a perf-bench output against a pinned baseline; fail when any
// benchmark regresses by more than `--threshold` (default 1.20 = +20%).
//
// Usage:
//   node scripts/perf-compare.mjs \
//     --current .hermes/phase2/perf-ubuntu.json \
//     --baseline ci/baselines/perf.baseline.json \
//     --threshold 1.20 \
//     --out .hermes/phase2/perf-ubuntu.diff.json

import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

function main() {
  const args = parseArgs(process.argv.slice(2));
  const currentPath = resolve(REPO_ROOT, args.current);
  const baselinePath = resolve(REPO_ROOT, args.baseline ?? 'ci/baselines/perf.baseline.json');
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/perf.diff.json');
  mkdirSync(dirname(outPath), {recursive: true});
  const threshold = Number(args.threshold ?? '1.20');

  const current = JSON.parse(readFileSync(currentPath, 'utf8'));
  const baseline = existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, 'utf8'))
    : {benches: []};
  const baseByLabel = new Map((baseline.benches ?? []).map(b => [b.label, b]));

  const rows = [];
  for (const c of current.benches ?? []) {
    const b = baseByLabel.get(c.label);
    if (!b) {
      rows.push({label: c.label, status: 'no-baseline'});
      continue;
    }
    const ratio = c.p95_ms / b.p95_ms;
    rows.push({
      label: c.label,
      status: ratio > threshold ? 'regression' : 'ok',
      current_p95_ms: c.p95_ms,
      baseline_p95_ms: b.p95_ms,
      ratio: Number(ratio.toFixed(3)),
      threshold,
    });
  }
  const regressions = rows.filter(r => r.status === 'regression');
  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    current: currentPath,
    baseline: baselinePath,
    threshold,
    summary: {total: rows.length, regressions: regressions.length, ok: rows.length - regressions.length, noBaseline: rows.filter(r => r.status === 'no-baseline').length},
    rows,
  };
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  process.stdout.write(`perf-compare: ${report.summary.ok}/${report.summary.total} within ${threshold}x; regressions=${report.summary.regressions}\n`);
  if (regressions.length > 0) process.exitCode = 1;
}

main();