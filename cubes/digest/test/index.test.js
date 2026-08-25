import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_CHUNK_BYTES,
  DEFAULT_MAX_INPUT_BYTES,
  DEFAULT_MAX_TOTAL_BYTES,
  DigestError,
  constantTimeEqual,
  createDigestConfig,
  digestAsync,
  digestHex,
  hmacAsync,
  hmacHex,
  hmacSha256,
  hmacSha512,
  sha256,
  sha512,
} from '../src/index.js';

async function* chunks(...values) {
  for (const value of values) yield value;
}

test('SHA-256 and SHA-512 known vectors are deterministic', () => {
  assert.equal(digestHex('sha256', 'abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(digestHex('sha512', 'abc'), 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f');
});

test('fixed algorithm helpers return bytes', () => {
  assert.equal(sha256('abc').byteLength, 32);
  assert.equal(sha512('abc').byteLength, 64);
});

test('HMAC SHA-256 and SHA-512 match known vectors', () => {
  assert.equal(hmacHex('sha256', 'key', 'The quick brown fox jumps over the lazy dog'), 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
  assert.equal(hmacHex('sha512', 'key', 'The quick brown fox jumps over the lazy dog'), 'b42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3a');
  assert.equal(hmacSha256('key', 'abc').byteLength, 32);
  assert.equal(hmacSha512('key', 'abc').byteLength, 64);
});

test('AsyncIterable digest matches synchronous digest across chunk boundaries', async () => {
  const source = chunks('a', 'b', 'c', Buffer.from('def'));
  assert.deepEqual(await digestAsync('sha256', source), sha256('abcdef'));
  assert.deepEqual(await digestAsync('sha512', chunks('a', 'bc')), sha512('abc'));
  assert.deepEqual(await hmacAsync('sha256', 'key', chunks('a', 'b', 'c')), hmacSha256('key', 'abc'));
});

test('configuration is immutable and defaults are finite', () => {
  const config = createDigestConfig();
  assert.equal(config.maxInputBytes, DEFAULT_MAX_INPUT_BYTES);
  assert.equal(config.maxChunkBytes, DEFAULT_MAX_CHUNK_BYTES);
  assert.equal(config.maxTotalBytes, DEFAULT_MAX_TOTAL_BYTES);
  assert.equal(Object.isFrozen(config), true);
});

test('input and key size limits are enforced', () => {
  assert.throws(() => sha256('12345', { maxInputBytes: 4 }), error => error instanceof DigestError && error.code === 'INPUT_TOO_LARGE');
  assert.throws(() => hmacSha256('12345', 'x', { maxInputBytes: 4 }), error => error instanceof DigestError && error.code === 'KEY_TOO_LARGE');
});

test('AsyncIterable chunk and total limits are enforced', async () => {
  await assert.rejects(() => digestAsync('sha256', chunks('12345'), { maxChunkBytes: 4 }), error => error instanceof DigestError && error.code === 'CHUNK_TOO_LARGE');
  await assert.rejects(() => digestAsync('sha256', chunks('abc', 'def'), { maxTotalBytes: 5 }), error => error instanceof DigestError && error.code === 'INPUT_TOO_LARGE');
});

test('AsyncIterable cancellation and invalid sources are deterministic', async () => {
  const controller = new AbortController();
  async function* cancellable() {
    yield 'a';
    controller.abort();
    yield 'b';
  }
  await assert.rejects(() => digestAsync('sha256', cancellable(), { signal: controller.signal }), error => error instanceof DigestError && error.code === 'CANCELLED');
  await assert.rejects(() => digestAsync('sha256', {}), error => error instanceof DigestError && error.code === 'INVALID_SOURCE');
});

test('constant-time equality returns true only for same bytes and false for length mismatch', () => {
  assert.equal(constantTimeEqual(Buffer.from('abc'), Buffer.from('abc')), true);
  assert.equal(constantTimeEqual(Buffer.from('abc'), Buffer.from('abd')), false);
  assert.equal(constantTimeEqual(Buffer.from('abc'), Buffer.from('ab')), false);
  assert.throws(() => constantTimeEqual('abc', Buffer.from('abc')), error => error instanceof DigestError && error.code === 'INVALID_INPUT');
});

test('algorithm and option failures are typed', () => {
  assert.throws(() => digestHex('md5', 'abc'), error => error instanceof DigestError && error.code === 'UNSUPPORTED_ALGORITHM');
  assert.throws(() => createDigestConfig({ maxChunkBytes: 0 }), error => error instanceof DigestError && error.code === 'INVALID_LIMIT');
});
