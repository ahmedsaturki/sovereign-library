import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CanonicalJsonError,
  DEFAULT_MAX_VALUE_BYTES,
  canonicalStringify,
  createCanonicalizer,
  normalize,
} from '../src/index.js';

const deepEqualJson = (value) => JSON.parse(JSON.stringify(value));

test('object insertion order does not affect canonical output', () => {
  const a = { z: 1, a: { y: true, x: 2 } };
  const b = { a: { x: 2, y: true }, z: 1 };
  assert.deepEqual(canonicalStringify(a), canonicalStringify(b));
  assert.equal(canonicalStringify(a), '{"a":{"x":2,"y":true},"z":1}');
});

test('normalized output is immutable and source is untouched', () => {
  const source = { nested: { value: 1 }, list: [true] };
  const output = normalize(source);
  source.nested.value = 2;
  source.list.push(false);
  assert.deepEqual(deepEqualJson(output), { nested: { value: 1 }, list: [true] });
  assert.ok(Object.isFrozen(output));
  assert.ok(Object.isFrozen(output.nested));
  assert.ok(Object.isFrozen(output.list));
});

test('negative zero is preserved and serialized explicitly', () => {
  const output = normalize({ value: -0 });
  assert.equal(Object.is(output.value, -0), true);
  assert.equal(canonicalStringify({ value: -0 }), '{"value":-0}');
});

test('arrays preserve order and strings use JSON escaping', () => {
  assert.equal(canonicalStringify(["a", "quote\"", "line\n"]), '["a","quote\\\"","line\\n"]');
});

test('unsupported values and circular references fail closed', () => {
  assert.throws(() => normalize({ value: Infinity }), (error) => error instanceof CanonicalJsonError && error.code === 'UNSUPPORTED_VALUE');
  assert.throws(() => normalize({ value: BigInt(1) }), (error) => error instanceof CanonicalJsonError && error.code === 'UNSUPPORTED_VALUE');
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => normalize(cycle), (error) => error instanceof CanonicalJsonError && error.code === 'CIRCULAR_REFERENCE');
  assert.throws(() => normalize({ date: new Date() }), (error) => error.code === 'UNSUPPORTED_OBJECT');
});

test('accessor properties are rejected without evaluating the getter', () => {
  let evaluated = false;
  const value = {};
  Object.defineProperty(value, 'secret', {
    enumerable: true,
    get() {
      evaluated = true;
      return 'x';
    },
  });
  assert.throws(() => normalize(value), (error) => error.code === 'UNSUPPORTED_OBJECT');
  assert.equal(evaluated, false);
});

test('bounds are deterministic and subsequent valid calls recover', () => {
  const engine = createCanonicalizer({ maxDepth: 2, maxNodes: 5, maxStringBytes: 4, maxValueBytes: 32 });
  assert.equal(DEFAULT_MAX_VALUE_BYTES, 4 * 1024 * 1024);
  assert.throws(() => engine.stringify({ value: '12345' }), (error) => error.code === 'STRING_LIMIT');
  assert.equal(engine.stringify({ ok: true }), '{"ok":true}');
  assert.throws(() => engine.stringify({ a: { b: { c: 1 } } }), (error) => error.code === 'DEPTH_LIMIT');
  assert.equal(engine.stringify({ ok: false }), '{"ok":false}');
});

test('null-prototype objects are supported', () => {
  const value = Object.create(null);
  value.b = 2;
  value.a = 1;
  assert.equal(canonicalStringify(value), '{"a":1,"b":2}');
});

test('configuration and errors are immutable and diagnostics are bounded', () => {
  const engine = createCanonicalizer();
  assert.ok(Object.isFrozen(engine));
  assert.ok(Object.isFrozen(engine.config));
  const secret = 'TOP-SECRET-VALUE';
  try {
    const tooLarge = { secret };
    createCanonicalizer({ maxStringBytes: 4 }).stringify(tooLarge);
    assert.fail('expected rejection');
  } catch (error) {
    assert.equal(error.message.includes(secret), false);
    assert.ok(Object.isFrozen(error));
  }
});
