#!/usr/bin/env node
// scripts/perf-bench.mjs
// Micro-benchmarks for representative Sovereign cubes.
//
// Picks a handful of representative cubes and times the canonical
// happy-path workload. The output is a deterministic JSON document used
// as the current data point for scripts/perf-compare.mjs.
//
// Usage:
//   node scripts/perf-bench.mjs --out .hermes/phase2/perf-ubuntu.json --label phase2-ci-ubuntu
//
// Dependency-free.

import {writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

import {parseArgs} from './parse-args.mjs';

async function timeIt(label, fn, iterations = 1000) {
  // Warmup.
  for (let i = 0; i < Math.min(iterations, 100); i++) await fn();
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const p = q => samples[Math.floor((samples.length - 1) * q)];
  return {
    label,
    iterations,
    p50_ms: Number(p(0.50).toFixed(4)),
    p95_ms: Number(p(0.95).toFixed(4)),
    p99_ms: Number(p(0.99).toFixed(4)),
    min_ms: Number(samples[0].toFixed(4)),
    max_ms: Number(samples[samples.length - 1].toFixed(4)),
  };
}

async function benchDigest() {
  const mod = await import(pathToFileURL(resolve(REPO_ROOT, 'cubes/digest/src/index.js')).href);
  const input = new TextEncoder().encode('sovereign-' + 'x'.repeat(64));
  return timeIt('digest.sha256', async () => {
    mod.sha256Hex(input);
  }, 1000);
}

async function benchCanonicalJson() {
  const mod = await import(pathToFileURL(resolve(REPO_ROOT, 'cubes/canonical-json/src/index.js')).href);
  const obj = {a: 1, b: ['x', 'y', {c: 'z'}], d: null, e: true};
  return timeIt('canonical-json.stringify', () => mod.canonicalize(obj), 1000);
}

async function benchSafePath() {
  const mod = await import(pathToFileURL(resolve(REPO_ROOT, 'cubes/safe-path-resolver-containment-boundary/src/index.js')).href);
  return timeIt('safe-path.resolve', () => mod.resolveWithinRoot('/root/dir', 'a/../b/c'), 1000);
}

async function benchResult() {
  const mod = await import(pathToFileURL(resolve(REPO_ROOT, 'cubes/result/src/index.js')).href);
  return timeIt('result.Ok', () => mod.Ok(1), 5000);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = resolve(REPO_ROOT, args.out ?? '.hermes/phase2/perf.json');
  mkdirSync(dirname(outPath), {recursive: true});
  const label = args.label ?? 'phase2-ci';

  const benches = [];
  for (const fn of [benchDigest, benchCanonicalJson, benchSafePath, benchResult]) {
    try {
      const r = await fn();
      benches.push(r);
    } catch (e) {
      benches.push({label: fn.name, error: String(e.message ?? e)});
    }
  }

  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    label,
    runtime: {node: process.version, platform: process.platform, arch: process.arch},
    benches,
  };
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  process.stdout.write(`perf-bench: ${benches.length} benches -> ${outPath}\n`);
}

main();