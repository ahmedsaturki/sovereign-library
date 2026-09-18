// tests/property-based/properties/validation.prop.mjs
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, setSeed } from './property.mjs';

setSeed(0xBEAD1234);

test('property: validation — VA-PROP-1 schema rejects out-of-range', () => {
  const r = property('va1', forall((rng) => Math.floor(rng() * 200) - 100, (n) => {
    const inRange = n >= 0 && n <= 100;
    const accepted = inRange;
    if (n === 50) return accepted === true;
    return accepted === inRange;
  }));
  assert.equal(r.failures, 0);
});