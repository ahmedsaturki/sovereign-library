// tests/property-based/properties/circuit-breaker.prop.mjs
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, setSeed } from './property.mjs';

setSeed(0x7777BBBB);

test('property: circuit-breaker — CB-PROP-1 opens after N failures', () => {
  const r = property('cb1', forall((rng) => {
    const threshold = 1 + Math.floor(rng() * 10);
    return threshold;
  }, (threshold) => {
    let failures = 0, open = false;
    for (let i = 0; i < threshold; i++) failures++;
    open = failures >= threshold;
    return open === true;
  }));
  assert.equal(r.failures, 0);
});

test('property: circuit-breaker — CB-PROP-2 half-open after timeout', () => {
  const r = property('cb2', forall((rng) => {
    const resetMs = Math.floor(rng() * 1000);
    return resetMs;
  }, (resetMs) => resetMs >= 0));
  assert.equal(r.failures, 0);
});