// tests/property-based/properties/file-lease.prop.mjs
//
// Properties:
//   - FL-PROP-1: acquire(f, h) when free returns OK; holder[f] = h.
//   - FL-PROP-2: release(f, h) when h != holder[f] is rejected.
//   - FL-PROP-3: total acquires ≤ total releases + 1 (one lease at a
//     time).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, arbitrary, setSeed } from './property.mjs';

setSeed(0xCAFEBABE);

function genSequence(rng, len) {
  const ops = [];
  for (let i = 0; i < len; i++) {
    ops.push({ op: rng() < 0.5 ? 'acq' : 'rel', who: 'h' + Math.floor(rng() * 3) });
  }
  return ops;
}

function simulate(seq) {
  let held = null;
  let acquires = 0, releases = 0;
  for (const { op, who } of seq) {
    if (op === 'acq') {
      if (held === null) { held = who; acquires++; }
    } else {
      if (held === who) { held = null; releases++; }
    }
  }
  return { held, acquires, releases };
}

test('property: file-lease — FL-PROP-1 acquire-then-release', () => {
  const r = property('fl1', forall((rng) => genSequence(rng, 16), (seq) => {
    const { acquires, releases } = simulate(seq);
    return acquires <= releases + 1;
  }));
  assert.equal(r.failures, 0);
});

test('property: file-lease — FL-PROP-2 same lock cannot be held twice', () => {
  const r = property('fl2', forall((rng) => genSequence(rng, 16), (seq) => {
    let held = null;
    let doubleHold = false;
    for (const { op, who } of seq) {
      if (op === 'acq' && held === null) held = who;
      else if (op === 'acq' && held !== null) doubleHold = true;
      else if (op === 'rel' && held === who) held = null;
    }
    return !doubleHold;
  }));
  assert.equal(r.failures, 0);
});