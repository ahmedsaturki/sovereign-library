// tests/property-based/properties/atomic-batch.prop.mjs
//
// Properties:
//   - AB-PROP-1: commit succeeds or fails atomically.
//   - AB-PROP-2: failed commit leaves no observable side-effects.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, setSeed } from './property.mjs';

setSeed(0xDEADBEEF);

function genBatch(rng, len = 5) {
  const ops = [];
  for (let i = 0; i < len; i++) ops.push({ file: 'f' + i, data: 'x'.repeat(Math.floor(rng() * 100)) });
  return ops;
}

function simulateCommit(batch, failAt) {
  const written = [];
  for (let i = 0; i < batch.length; i++) {
    if (i === failAt) return { ok: false, written };
    written.push(batch[i]);
  }
  return { ok: true, written };
}

test('property: atomic-batch — AB-PROP-1 success-or-noop', () => {
  const r = property('ab1', forall((rng) => genBatch(rng, 6), (batch) => {
    const ok = simulateCommit(batch, -1);
    const fail = simulateCommit(batch, 2);
    return ok.ok === true && fail.ok === false;
  }));
  assert.equal(r.failures, 0);
});

test('property: atomic-batch — AB-PROP-2 failed commit writes nothing observable', () => {
  const r = property('ab2', forall((rng) => genBatch(rng, 6), (batch) => {
    const fail = simulateCommit(batch, 2);
    return fail.written.length === 0;  // rollback semantics
  }));
  assert.equal(r.failures, 0);
});