#!/usr/bin/env node
// scripts/mutate.mjs
//
// Phase-3 / Continuity-Hardening Wave — mutation runner.
//
// For each operator in --operators, applies it once per file under
// --target, runs the corresponding test suite, and records whether
// any test failed. Emits a JSON transcript under --out.
//
//   node scripts/mutate.mjs \
//     --target cubes/safe-path-resolver-containment-boundary \
//     --test "node --test cubes/safe-path-resolver-containment-boundary/test/index.test.js" \
//     --out .hermes/phase3/mutation

import { parseArgsDefault as parseArgs } from './parse-args.mjs';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { operators } from '../tests/mutation-testing/mutators/operators.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const args = parseArgs(process.argv.slice(2));
if (!args.target || !args.test) {
  console.error('usage: mutate.mjs --target <dir> --test "<test cmd>" [--operators <csv>] [--out <dir>] [--strict]');
  process.exit(2);
}
const target = resolve(REPO_ROOT, args.target);
const testCmd = args.test;
const outDir = resolve(args.out ?? '.hermes/phase3/mutation');
const opNames = (args.operators ?? Object.keys(operators).join(',')).split(',').filter(Boolean);
const strict = Boolean(args.strict);

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const summary = {
  started: new Date().toISOString(),
  target: relative(REPO_ROOT, target),
  operators: opNames,
  total: 0, killed: 0, survived: 0, unviable: 0,
  mutations: [],
};

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile() && p.endsWith('.js')) yield p;
  }
}

function listJs(dir) {
  const out = [];
  for (const f of walk(dir)) out.push(f);
  return out;
}

// Save original src so we can restore.
const originals = new Map();

function applyMutation(file, opName) {
  const orig = readFileSync(file, 'utf8');
  if (!originals.has(file)) originals.set(file, orig);
  const op = operators[opName];
  const { src, mutated } = op(orig);
  if (!mutated) return null;
  writeFileSync(file, src);
  return { file, opName };
}

function revertMutation(m) {
  const orig = originals.get(m.file);
  if (orig !== undefined) writeFileSync(m.file, orig);
}

function runTest() {
  try {
    execFileSync('sh', ['-c', testCmd], { cwd: REPO_ROOT, stdio: 'pipe', timeout: 60_000 });
    return 'pass';
  } catch (err) {
    return 'fail';
  }
}

for (const f of listJs(target)) {
  for (const opName of opNames) {
    const m = applyMutation(f, opName);
    if (!m) { summary.unviable += 1; continue; }
    summary.total += 1;
    const result = runTest();
    if (result === 'fail') summary.killed += 1;
    else summary.survived += 1;
    summary.mutations.push({ file: relative(REPO_ROOT, f), op: opName, result });
    revertMutation(m);
  }
}

// Restore originals (defensive).
for (const [f, src] of originals) writeFileSync(f, src);

summary.finished = new Date().toISOString();
summary.score = summary.total ? +(summary.killed / summary.total).toFixed(3) : 1;
writeFileSync(join(outDir, 'mutation-summary.json'), JSON.stringify(summary, null, 2));

console.log(`mutate: total=${summary.total} killed=${summary.killed} survived=${summary.survived} score=${summary.score}`);
if (strict && summary.score < 0.7) {
  console.error(`mutate: mutation score ${summary.score} < 0.7 threshold`);
  process.exit(1);
}