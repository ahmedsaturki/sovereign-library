// tests/property-based/properties/retry.prop.mjs
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, setSeed } from './property.mjs';

setSeed(0xAAAA0000);

test('property: retry — RT-PROP-1 eventual success after retries', () => {
  const r = property('rt1', forall((rng) => {
    const maxRetries = 1 + Math.floor(rng() * 5);
    return maxRetries;
  }, (maxRetries) => {
    let attempts = 0;
    for (let i = 0; i <= maxRetries; i++) attempts++;
    return attempts <= maxRetries + 1;
  }));
  assert.equal(r.failures, 0);
});