// tests/property-based/properties/serialization.prop.mjs
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, setSeed } from './property.mjs';

setSeed(0xF00DBABE);

function genString(rng) {
  const alph = 'abcdef0123456789-_';
  let s = '';
  for (let i = 0; i < 16; i++) s += alph[Math.floor(rng() * alph.length)];
  return s;
}

test('property: serialization — SE-PROP-1 JSON roundtrip', () => {
  const r = property('se1', forall(genString, (s) => {
    return JSON.parse(JSON.stringify(s)) === s;
  }));
  assert.equal(r.failures, 0);
});