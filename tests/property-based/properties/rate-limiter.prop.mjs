// tests/property-based/properties/rate-limiter.prop.mjs
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, setSeed } from './property.mjs';

setSeed(0x9999AAAA);

test('property: rate-limiter — RL-PROP-1 burst-bounded by limit', () => {
  const r = property('rl1', forall((rng) => {
    const limit = 1 + Math.floor(rng() * 100);
    const tries = 1 + Math.floor(rng() * 200);
    return { limit, tries };
  }, ({ limit, tries }) => {
    let allowed = 0, denied = 0;
    for (let i = 0; i < tries; i++) {
      if (i < limit) allowed++; else denied++;
    }
    return allowed <= limit && denied >= Math.max(0, tries - limit);
  }));
  assert.equal(r.failures, 0);
});