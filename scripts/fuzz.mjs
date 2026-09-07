#!/usr/bin/env node
// scripts/fuzz.mjs
//
// Phase-3 / Continuity-Hardening Wave — stdlib fuzz harness.
//
// For each harness under tests/fuzz-testing/harness/<name>.harness.mjs,
// generates random inputs, runs them through the harness, and emits
// a transcript. AFL / libFuzzer integration is opt-in.
//
// Usage:
//   node scripts/fuzz.mjs --out .hermes/phase3/fuzz --duration 30
//   node scripts/fuzz.mjs --target safe-path-resolver --duration 60

import { parseArgsDefault as parseArgs } from './parse-args.mjs';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const args = parseArgs(process.argv.slice(2));
const outDir = resolve(args.out ?? '.hermes/phase3/fuzz');
const duration = parseInt(args.duration ?? '30', 10);
const targetFilter = args.target;

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const summary = { started: new Date().toISOString(), duration, runs: [], crashes: 0 };

function* mutate(buf, rng) {
  yield buf;
  for (let i = 0; i < 1024; i++) {
    const out = Buffer.from(buf);
    const op = Math.floor(rng() * 4);
    if (out.length === 0) { out[0] = rng() * 256 | 0; }
    else {
      const idx = Math.floor(rng() * out.length);
      if (op === 0) out[idx] = rng() * 256 | 0;
      else if (op === 1) out[idx] = 0;
      else if (op === 2) { /* delete */ const n = out.toString('utf8').slice(0, idx) + out.toString('utf8').slice(idx + 1); Buffer.from(n, 'utf8').copy(out); }
      else if (op === 3) out[idx] = (out[idx] + 1) & 0xff;
    }
    yield out;
  }
}

function rngFromSeed(s) {
  let state = s >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

const harnessDir = join(REPO_ROOT, 'tests', 'fuzz-testing', 'harness');
const seed = (Date.now() & 0xffffffff) >>> 0;

for (const f of readdirSync(harnessDir)) {
  if (!f.endsWith('.harness.mjs')) continue;
  const name = basename(f, '.harness.mjs');
  if (targetFilter && name !== targetFilter) continue;
  const mod = await import(pathToFileURL(join(harnessDir, f)).href);
  const fn = mod.fuzz;
  let runs = 0, crashes = 0;
  const start = Date.now();
  while ((Date.now() - start) / 1000 < duration) {
    for (const buf of mutate(Buffer.from('seed'), rngFromSeed((seed + runs) >>> 0))) {
      runs += 1;
      const ok = fn(buf);
      if (!ok) crashes += 1;
    }
  }
  summary.runs.push({ name, runs, crashes });
  summary.crashes += crashes;
  console.log(`fuzz: ${name} runs=${runs} crashes=${crashes}`);
  writeFileSync(join(outDir, `${name}.transcript.json`), JSON.stringify({ name, runs, crashes }, null, 2));
}

summary.finished = new Date().toISOString();
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`fuzz: ${summary.runs.length} harnesses, ${summary.crashes} crashes`);
process.exit(summary.crashes > 0 ? 1 : 0);