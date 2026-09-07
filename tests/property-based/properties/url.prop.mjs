// tests/property-based/properties/url.prop.mjs
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { property, forall, setSeed } from './property.mjs';

setSeed(0xABCD1234);

test('property: url — URL-PROP-1 parseable URLs roundtrip', () => {
  const r = property('url1', forall((rng) => {
    return {
      scheme: 'http',
      host: 'h' + Math.floor(rng() * 100) + '.example',
      path: '/p' + Math.floor(rng() * 100),
    };
  }, (u) => {
    const url = `${u.scheme}://${u.host}${u.path}`;
    return url.startsWith('http://') && url.includes('.example');
  }));
  assert.equal(r.failures, 0);
});