import test from 'node:test';
import assert from 'node:assert/strict';
import { get, set, pick, omit, compact, normalizeStrings, dedupe, merge, canonicalJson, DataCubeError } from '../src/index.js';

test('nested get/set/pick/omit are deterministic', () => {
  const data = { user: { name: '  Ahmed  ', email: 'a@example.com', secret: 'x' } };
  set(data, 'user.phone', '123');
  assert.equal(get(data, 'user.phone'), '123');
  assert.deepEqual(pick(data, ['user.name', 'user.phone']), { user: { name: '  Ahmed  ', phone: '123' } });
  assert.deepEqual(omit(data, ['user.secret']), { user: { name: '  Ahmed  ', email: 'a@example.com', phone: '123' } });
});

test('compact and string normalization remove common payload noise', () => {
  const value = { a: null, b: undefined, c: '  hello   world ', d: [' ', null, ' X '] };
  assert.deepEqual(normalizeStrings(compact(value), { case: 'lower' }), { c: 'hello world', d: ['', 'x'] });
});

test('dedupe preserves first occurrence and validates key function', () => {
  assert.deepEqual(dedupe([{ id: 1 }, { id: 1 }, { id: 2 }], item => item.id), [{ id: 1 }, { id: 2 }]);
  assert.throws(() => dedupe([], null), error => error instanceof DataCubeError && error.code === 'INVALID_KEY');
});

test('merge performs isolated deep merge', () => {
  const base = { user: { name: 'A', flags: { a: true } } };
  const result = merge(base, { user: { flags: { b: true } } });
  assert.deepEqual(result, { user: { name: 'A', flags: { a: true, b: true } } });
  assert.deepEqual(base, { user: { name: 'A', flags: { a: true } } });
});

test('clone-backed operations preserve supported structured values', () => {
  const value = { bigint: 123n, nested: { ok: true } };
  assert.deepEqual(pick(value, ['bigint']), value);
  const result = merge(value, { nested: { added: true } });
  assert.equal(result.bigint, 123n);
  assert.deepEqual(result.nested, { ok: true, added: true });
});

test('canonical JSON sorts object keys recursively and rejects non-JSON values', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
  assert.throws(() => canonicalJson({ value: 1n }), error => error instanceof DataCubeError && error.code === 'CANONICALIZE_FAILED');
});

test('invalid inputs produce typed errors', () => {
  assert.throws(() => get({}, ''), error => error instanceof DataCubeError && error.code === 'INVALID_PATH');
  assert.throws(() => set(null, 'a', 1), error => error instanceof DataCubeError && error.code === 'INVALID_DATA');
});
