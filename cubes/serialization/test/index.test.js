import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_COLLECTION_ITEMS,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_STRING_BYTES,
  MAGIC,
  VERSION,
  SerializationError,
  createSerializationConfig,
  decode,
  encode,
} from '../src/index.js';

test('primitive values round-trip exactly', () => {
  const values = [null, false, true, 0, -0, 1.5, '', 'hello', 'مصر'];
  for (const value of values) assert.deepEqual(decode(encode(value)), value);
});

test('arrays and nested plain objects round-trip', () => {
  const value = {
    z: [1, true, null, { beta: 'x', alpha: 2 }],
    a: 'first',
  };
  assert.deepEqual(decode(encode(value)), value);
});

test('object key ordering is deterministic', () => {
  const first = encode({ b: 2, a: 1, c: { z: 3, y: 2 } });
  const second = encode({ c: { y: 2, z: 3 }, a: 1, b: 2 });
  assert.deepEqual(first, second);
});

test('wire header is stable and versioned', () => {
  const encoded = encode(null);
  assert.deepEqual(encoded.subarray(0, MAGIC.length), MAGIC);
  assert.equal(encoded[MAGIC.length], VERSION);
});

test('supported numbers preserve negative zero', () => {
  const decoded = decode(encode(-0));
  assert.equal(Object.is(decoded, -0), true);
});

test('unsupported values fail before encoding', () => {
  assert.throws(() => encode(undefined), error => error instanceof SerializationError && error.code === 'UNSUPPORTED_VALUE');
  assert.throws(() => encode(Symbol('x')), error => error instanceof SerializationError && error.code === 'UNSUPPORTED_VALUE');
  assert.throws(() => encode(() => 1), error => error instanceof SerializationError && error.code === 'UNSUPPORTED_VALUE');
  assert.throws(() => encode(NaN), error => error instanceof SerializationError && error.code === 'UNSUPPORTED_VALUE');
  assert.throws(() => encode(new Date()), error => error instanceof SerializationError && error.code === 'UNSUPPORTED_VALUE');
});

test('depth and collection limits are bounded', () => {
  const nested = { value: { value: { value: 1 } } };
  assert.throws(() => encode(nested, { maxDepth: 2 }), error => error instanceof SerializationError && error.code === 'MAX_DEPTH_EXCEEDED');
  assert.throws(() => encode([1, 2, 3], { maxCollectionItems: 2 }), error => error instanceof SerializationError && error.code === 'COLLECTION_TOO_LARGE');
});

test('string and total payload limits are bounded', () => {
  assert.throws(() => encode('12345', { maxStringBytes: 4 }), error => error instanceof SerializationError && error.code === 'STRING_TOO_LARGE');
  assert.throws(() => encode({ text: '12345' }, { maxBytes: 6 }), error => error instanceof SerializationError && error.code === 'PAYLOAD_TOO_LARGE');
});

test('decoder rejects invalid headers, versions, tags, duplicates and trailing bytes', () => {
  const valid = encode({ a: 1 });
  const badMagic = Buffer.from(valid); badMagic[0] ^= 0xff;
  assert.throws(() => decode(badMagic), error => error instanceof SerializationError && error.code === 'INVALID_HEADER');
  const badVersion = Buffer.from(valid); badVersion[MAGIC.length] = VERSION + 1;
  assert.throws(() => decode(badVersion), error => error instanceof SerializationError && error.code === 'UNSUPPORTED_VERSION');
  const badTag = Buffer.from([...​MAGIC, VERSION, 0xff]);
  assert.throws(() => decode(badTag), error => error instanceof SerializationError && error.code === 'INVALID_TAG');
  assert.throws(() => decode(Buffer.concat([valid, Buffer.from([0])])), error => error instanceof SerializationError && error.code === 'TRAILING_BYTES');
});

test('decoder rejects duplicate object keys deterministically', () => {
  const encoded = Buffer.from(encode({ a: 1 }));
  // Header + object tag + count(1) + key length(1) + key + number tag + value.
  // Convert the count to 2 and duplicate the first entry bytes.
  const firstEntry = encoded.subarray(10);
  const countOffset = MAGIC.length + 1 + 1;
  const prefix = encoded.subarray(0, countOffset);
  const count = Buffer.alloc(4); count.writeUInt32BE(2);
  const duplicated = Buffer.concat([prefix, count, firstEntry, firstEntry]);
  assert.throws(() => decode(duplicated), error => error instanceof SerializationError && error.code === 'DUPLICATE_KEY');
});

test('decoder detects truncation', () => {
  const encoded = encode({ a: [1, 2, 3] });
  assert.throws(() => decode(encoded.subarray(0, encoded.length - 1)), error => error instanceof SerializationError && error.code === 'TRUNCATED_INPUT');
});

test('configuration is immutable and finite', () => {
  const config = createSerializationConfig();
  assert.equal(config.maxBytes, DEFAULT_MAX_BYTES);
  assert.equal(config.maxDepth, DEFAULT_MAX_DEPTH);
  assert.equal(config.maxCollectionItems, DEFAULT_MAX_COLLECTION_ITEMS);
  assert.equal(config.maxStringBytes, DEFAULT_MAX_STRING_BYTES);
  assert.equal(Object.isFrozen(config), true);
});
