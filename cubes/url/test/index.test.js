import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UrlError,
  base64Decode,
  base64Encode,
  base64UrlDecode,
  base64UrlEncode,
  buildQuery,
  decodePathSegment,
  decodeURIComponentStrict,
  decodeURIComponentTolerant,
  formDecode,
  formEncode,
  parseQuery,
  parseUrl,
  utf8Decode,
  utf8Encode,
} from '../src/index.js';

test('URL parsing normalizes absolute URLs and exposes immutable metadata', () => {
  const parsed = parseUrl('https://example.com/a?q=1#x');
  assert.equal(parsed.protocol, 'https:');
  assert.equal(parsed.pathname, '/a');
  assert.equal(Object.isFrozen(parsed), true);
});

test('query parsing preserves duplicate keys and builder is deterministic', () => {
  assert.deepEqual(parseQuery('?a=1&a=2&b=x'), { a: ['1', '2'], b: ['x'] });
  assert.equal(buildQuery({ a: ['1', '2'], b: 'x' }), 'a=1&a=2&b=x');
  assert.deepEqual(formDecode(formEncode({ q: 'hello world' })), { q: ['hello world'] });
});

test('strict and tolerant percent decoding behave explicitly', () => {
  assert.equal(decodeURIComponentStrict('hello%20world'), 'hello world');
  assert.throws(() => decodeURIComponentStrict('%ZZ'), error => error instanceof UrlError && error.code === 'INVALID_PERCENT_ENCODING');
  assert.equal(decodeURIComponentTolerant('%ZZ%20ok'), '%ZZ ok');
});

test('UTF-8 helpers support valid text and fatal invalid bytes', () => {
  const bytes = utf8Encode('مصر');
  assert.equal(utf8Decode(bytes), 'مصر');
  assert.throws(() => utf8Decode(Uint8Array.from([0xff]), { fatal: true }), error => error instanceof UrlError && error.code === 'INVALID_UTF8');
});

test('Base64 and Base64URL round-trip deterministically', () => {
  const encoded = base64Encode('hello');
  assert.equal(encoded, 'aGVsbG8=');
  assert.deepEqual(base64Decode(encoded), Uint8Array.from(Buffer.from('hello')));
  const url = base64UrlEncode('a?b/c');
  assert.equal(base64UrlDecode(url).byteLength, utf8Encode('a?b/c').byteLength);
});

test('path segments use strict component encoding', () => {
  assert.equal(decodePathSegment('a%2Fb'), 'a/b');
});

test('size limits and malformed URL/base64 are deterministic errors', () => {
  assert.throws(() => parseUrl('x', { base: 'not a url' }), error => error instanceof UrlError && error.code === 'INVALID_URL');
  assert.throws(() => parseQuery('abc', { maxBytes: 2 }), error => error instanceof UrlError && error.code === 'INPUT_TOO_LARGE');
  assert.throws(() => base64Decode('abc'), error => error instanceof UrlError && error.code === 'INVALID_BASE64');
  assert.throws(() => base64UrlDecode('a'), error => error instanceof UrlError && error.code === 'INVALID_BASE64URL');
});
