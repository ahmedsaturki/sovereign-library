import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CompressionError,
  DEFAULT_MAX_INPUT_BYTES,
  DEFAULT_MAX_OUTPUT_BYTES,
  compress,
  createCompressionConfig,
  decompress,
  deflate,
  deflateSync,
  gzip,
  gzipSync,
  gunzip,
  gunzipSync,
  inflate,
  inflateSync,
} from '../src/index.js';

test('gzip and gunzip round-trip text deterministically', () => {
  const source = 'Sovereign Library compression test — مصر';
  const compressed = gzipSync(source);
  assert.notEqual(compressed.toString('utf8'), source);
  assert.equal(gunzipSync(compressed).toString('utf8'), source);
});

test('deflate and inflate round-trip binary bytes', () => {
  const source = Uint8Array.from({ length: 256 }, (_, index) => index);
  const compressed = deflateSync(source);
  assert.deepEqual(Uint8Array.from(inflateSync(compressed)), source);
});

test('sync and async APIs produce compatible results', async () => {
  const source = 'async parity';
  assert.deepEqual(await gzip(source), gzipSync(source));
  assert.deepEqual(await gunzip(await gzip(source)), Buffer.from(source));
  assert.deepEqual(await deflate(source), deflateSync(source));
  assert.deepEqual(await inflate(await deflate(source)), Buffer.from(source));
});

test('generic format helpers select gzip and deflate explicitly', async () => {
  const source = 'generic compression';
  const gzipData = await compress(source, { format: 'gzip' });
  const deflateData = await compress(source, { format: 'deflate' });
  assert.equal((await decompress(gzipData, { format: 'gzip' })).toString(), source);
  assert.equal((await decompress(deflateData, { format: 'deflate' })).toString(), source);
});

test('configuration is immutable and exposes finite defaults', () => {
  const config = createCompressionConfig();
  assert.equal(config.maxInputBytes, DEFAULT_MAX_INPUT_BYTES);
  assert.equal(config.maxOutputBytes, DEFAULT_MAX_OUTPUT_BYTES);
  assert.equal(Object.isFrozen(config), true);
});

test('input limits are enforced before compression/decompression work', () => {
  assert.throws(() => gzipSync('12345', { maxInputBytes: 4 }), error => error instanceof CompressionError && error.code === 'INPUT_TOO_LARGE');
  assert.throws(() => gunzipSync(Buffer.alloc(5), { maxInputBytes: 4 }), error => error instanceof CompressionError && error.code === 'INPUT_TOO_LARGE');
});

test('decompression output limits prevent oversized expansion', () => {
  const source = Buffer.alloc(64 * 1024, 65);
  const compressed = gzipSync(source);
  assert.throws(() => gunzipSync(compressed, { maxOutputBytes: 1024 }), error => error instanceof CompressionError && error.code === 'OUTPUT_TOO_LARGE');
});

test('invalid compressed data becomes a typed error', () => {
  assert.throws(() => gunzipSync(Buffer.from('not gzip')), error => error instanceof CompressionError && error.code === 'DECOMPRESS_FAILED');
  assert.throws(() => inflateSync(Buffer.from('not deflate')), error => error instanceof CompressionError && error.code === 'DECOMPRESS_FAILED');
});

test('invalid configuration and formats fail deterministically', async () => {
  assert.throws(() => createCompressionConfig({ maxInputBytes: 0 }), error => error instanceof CompressionError && error.code === 'INVALID_LIMIT');
  assert.throws(() => gzipSync(null), error => error instanceof CompressionError && error.code === 'INVALID_INPUT');
  await assert.rejects(() => compress('x', { format: 'br' }), error => error instanceof CompressionError && error.code === 'INVALID_FORMAT');
  await assert.rejects(() => decompress('x', { format: 'zip' }), error => error instanceof CompressionError && error.code === 'INVALID_FORMAT');
});
