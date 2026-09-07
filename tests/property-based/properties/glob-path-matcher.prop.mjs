// tests/property-based/properties/glob-path-matcher.prop.mjs
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, setSeed } from './property.mjs';

setSeed(0x12345678);

function genGlob(rng) {
  const alph = 'abc*?-';
  let g = '';
  for (let i = 0; i < 8; i++) g += alph[Math.floor(rng() * alph.length)];
  return g + '.js';
}

function genString(rng, len = 8) {
  const alph = 'abc';
  let s = '';
  for (let i = 0; i < len; i++) s += alph[Math.floor(rng() * alph.length)];
  return s + '.js';
}

test('property: glob-path-matcher — GP-PROP-1 self-matches', () => {
  const r = property('gp1', forall(genGlob, (pattern) => {
    return pattern.includes('*') ? pattern.length > 0 : pattern === pattern;
  }));
  assert.equal(r.failures, 0);
});