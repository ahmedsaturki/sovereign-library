// tests/property-based/properties/redaction.prop.mjs
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, setSeed } from './property.mjs';

setSeed(0xFEEDFACE);

test('property: redaction — RD-PROP-1 sensitive data is masked', () => {
  const r = property('rd1', forall((rng) => {
    const chars = '0123456789';
    let s = '';
    for (let i = 0; i < 16; i++) s += chars[Math.floor(rng() * chars.length)];
    return s;
  }, (s) => {
    const masked = '*'.repeat(s.length);
    return masked.length === s.length && !/\d/.test(masked);
  }));
  assert.equal(r.failures, 0);
});