// tests/property-based/properties/digest.prop.mjs
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, setSeed } from './property.mjs';
import { createHash } from 'node:crypto';

setSeed(0xD1D1D1D1);

function genBytes(rng) {
  const out = [];
  for (let i = 0; i < 64; i++) out.push(Math.floor(rng() * 256));
  return Buffer.from(out);
}

test('property: digest — DG-PROP-1 same input → same hash', () => {
  const r = property('dg1', forall(genBytes, (b) => {
    const h1 = createHash('sha256').update(b).digest('hex');
    const h2 = createHash('sha256').update(b).digest('hex');
    return h1 === h2;
  }));
  assert.equal(r.failures, 0);
});

test('property: digest — DG-PROP-2 different input → different hash', () => {
  const r = property('dg2', forall((rng) => {
    const a = genBytes(rng);
    const b = Buffer.concat([a, Buffer.from([0x00])]);
    return [a, b];
  }, ([a, b]) => {
    const ha = createHash('sha256').update(a).digest('hex');
    const hb = createHash('sha256').update(b).digest('hex');
    return ha !== hb;
  }));
  assert.equal(r.failures, 0);
});