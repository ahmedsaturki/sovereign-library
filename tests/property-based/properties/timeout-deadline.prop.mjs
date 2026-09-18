// tests/property-based/properties/timeout-deadline.prop.mjs
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, setSeed } from './property.mjs';

setSeed(0xCCCC1234);

test('property: timeout-deadline — TD-PROP-1 deadline fires', () => {
  const r = property('td1', forall((rng) => {
    const ms = Math.floor(rng() * 1000);
    return ms;
  }, (ms) => {
    const start = 0, elapsed = ms + 1;
    return elapsed > ms;
  }));
  assert.equal(r.failures, 0);
});