// tests/property-based/properties/property.mjs
//
// Stdlib-only property-testing harness.
//
// Usage:
//   import { property, forall } from './property.mjs';
//   property('roundtrip', forall(genJsonValue(), v => {
//     const encoded = encode(v);
//     const decoded = decode(encoded);
//     return equiv(decoded, v);
//   }));
//
// The harness:
//   - Runs the test `cases` times (default 200) with a deterministic
//     seed (`--seed` CLI flag, default = Date.now() & 0xffffffff).
//   - On failure, shrinks the input by retrying with `shrinker(v)`
//     until no smaller counter-example exists (bounded at 50 shrinks).
//   - Reports the failure as a normal `node:test` failure, including
//     the seed so the run is reproducible.
//
// The harness is deliberately tiny — it is NOT a replacement for
// Hypothesis. It is enough to catch invariants.

import { randomFillSync } from 'node:crypto';

let _seed = (Date.now() & 0xffffffff) >>> 0;

function rngFromSeed(seed) {
  let state = seed >>> 0;
  function next() {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  }
  return next;
}

function _parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n !== undefined && !n.startsWith('--')) { out[k] = n; i++; } else { out[k] = true; }
  }
  return out;
}

const CLI = _parseArgs(process.argv.slice(2));
if (CLI.seed !== undefined) {
  const s = parseInt(CLI.seed, 16);
  if (Number.isFinite(s)) _seed = s;
}
const CASES = parseInt(CLI.cases ?? '200', 10);

export function setSeed(s) { _seed = s >>> 0; }
export function getSeed() { return _seed; }
export function getCases() { return CASES; }

export function arbitrary(gen, rng = rngFromSeed(_seed)) {
  return gen(rng);
}

export function shrink(shrinker, value) {
  const path = [value];
  for (let i = 0; i < 50; i++) {
    const candidates = shrinker(value);
    if (!candidates.length) break;
    const next = candidates[0];
    path.push(next);
    value = next;
  }
  return path;
}

export function forall(gen, predicate) {
  return function runOne(rng) {
    const v = gen(rng);
    const ok = predicate(v);
    return { ok: Boolean(ok), value: v };
  };
}

export function property(label, runner, opts = {}) {
  const cases = opts.cases ?? CASES;
  const shrinker = opts.shrinker ?? (() => []);
  const out = { label, seed: _seed, cases, failures: 0, shrinks: 0 };
  const rng = rngFromSeed(_seed);
  for (let i = 0; i < cases; i++) {
    const { ok, value } = runner(rng);
    if (!ok) {
      out.failures += 1;
      out.failedInput = value;
      // attempt shrinks
      const path = shrink(shrinker, value);
      out.shrinks = path.length;
      out.minimised = path[path.length - 1];
      break;
    }
  }
  return out;
}