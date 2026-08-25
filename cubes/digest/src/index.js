import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_MAX_INPUT_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_CHUNK_BYTES = 1 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 256 * 1024 * 1024;
const SUPPORTED_HASHES = new Set(['sha256', 'sha512']);

export class DigestError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'DigestError';
    this.code = code;
    this.operation = options.operation ?? null;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

function assertPositiveLimit(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new DigestError('INVALID_LIMIT', `${name} must be a safe integer >= 1`);
}

function normalizeOptions(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new DigestError('INVALID_OPTIONS', 'Digest options must be an object');
  const maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const maxChunkBytes = options.maxChunkBytes ?? DEFAULT_MAX_CHUNK_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  assertPositiveLimit(maxInputBytes, 'maxInputBytes');
  assertPositiveLimit(maxChunkBytes, 'maxChunkBytes');
  assertPositiveLimit(maxTotalBytes, 'maxTotalBytes');
  return Object.freeze({ maxInputBytes, maxChunkBytes, maxTotalBytes });
}

function normalizeAlgorithm(algorithm) {
  if (typeof algorithm !== 'string') throw new DigestError('INVALID_ALGORITHM', 'Algorithm must be a string');
  const normalized = algorithm.toLowerCase().replaceAll('-', '');
  if (!SUPPORTED_HASHES.has(normalized)) throw new DigestError('UNSUPPORTED_ALGORITHM', `Unsupported hash algorithm: ${algorithm}`);
  return normalized;
}

function toBuffer(input) {
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  if (input instanceof Uint8Array) return Buffer.from(input);
  throw new DigestError('INVALID_INPUT', 'Input must be a string or Uint8Array');
}

function digestBuffer(algorithm, input, options, operation) {
  const config = normalizeOptions(options);
  const normalized = normalizeAlgorithm(algorithm);
  const buffer = toBuffer(input);
  if (buffer.byteLength > config.maxInputBytes) throw new DigestError('INPUT_TOO_LARGE', `Input exceeds ${config.maxInputBytes} bytes`, { operation, statusCode: 413 });
  try { return Buffer.from(createHash(normalized).update(buffer).digest()); }
  catch (cause) { throw new DigestError('DIGEST_FAILED', 'Digest operation failed', { cause, operation }); }
}

function hmacBuffer(algorithm, key, input, options, operation) {
  const config = normalizeOptions(options);
  const data = toBuffer(input);
  const secret = toBuffer(key);
  if (secret.byteLength > config.maxInputBytes) throw new DigestError('KEY_TOO_LARGE', `Key exceeds ${config.maxInputBytes} bytes`, { operation, statusCode: 413 });
  if (data.byteLength > config.maxInputBytes) throw new DigestError('INPUT_TOO_LARGE', `Input exceeds ${config.maxInputBytes} bytes`, { operation, statusCode: 413 });
  const normalized = normalizeAlgorithm(algorithm);
  try { return Buffer.from(createHmac(normalized, secret).update(data).digest()); }
  catch (cause) { throw new DigestError('HMAC_FAILED', 'HMAC operation failed', { cause, operation }); }
}

export function createDigestConfig(options = {}) { return normalizeOptions(options); }
export function sha256(input, options = {}) { return digestBuffer('sha256', input, options, 'sha256'); }
export function sha512(input, options = {}) { return digestBuffer('sha512', input, options, 'sha512'); }
export function hmacSha256(key, input, options = {}) { return hmacBuffer('sha256', key, input, options, 'hmac-sha256'); }
export function hmacSha512(key, input, options = {}) { return hmacBuffer('sha512', key, input, options, 'hmac-sha512'); }
export function digestHex(algorithm, input, options = {}) { return digestBuffer(algorithm, input, options, 'digest').toString('hex'); }
export function hmacHex(algorithm, key, input, options = {}) { return hmacBuffer(algorithm, key, input, options, 'hmac').toString('hex'); }

export async function digestAsync(algorithm, source, options = {}) {
  const config = normalizeOptions(options);
  const hash = createHash(normalizeAlgorithm(algorithm));
  let total = 0;
  try {
    if (source === null || source === undefined || typeof source[Symbol.asyncIterator] !== 'function') throw new DigestError('INVALID_SOURCE', 'Source must be an AsyncIterable');
    for await (const chunk of source) {
      if (options.signal?.aborted) throw new DigestError('CANCELLED', 'Digest cancelled', { statusCode: 499, operation: 'digest' });
      const buffer = toBuffer(chunk);
      if (buffer.byteLength > config.maxChunkBytes) throw new DigestError('CHUNK_TOO_LARGE', `Chunk exceeds ${config.maxChunkBytes} bytes`, { statusCode: 413, operation: 'digest' });
      total += buffer.byteLength;
      if (total > config.maxTotalBytes) throw new DigestError('INPUT_TOO_LARGE', `Total input exceeds ${config.maxTotalBytes} bytes`, { statusCode: 413, operation: 'digest' });
      hash.update(buffer);
    }
    return Buffer.from(hash.digest());
  } catch (cause) {
    if (cause instanceof DigestError) throw cause;
    throw new DigestError('DIGEST_FAILED', 'Async digest operation failed', { cause, operation: 'digest' });
  }
}

export async function hmacAsync(algorithm, key, source, options = {}) {
  const config = normalizeOptions(options);
  const secret = toBuffer(key);
  if (secret.byteLength > config.maxInputBytes) throw new DigestError('KEY_TOO_LARGE', `Key exceeds ${config.maxInputBytes} bytes`, { statusCode: 413, operation: 'hmac' });
  const hmac = createHmac(normalizeAlgorithm(algorithm), secret);
  let total = 0;
  try {
    if (source === null || source === undefined || typeof source[Symbol.asyncIterator] !== 'function') throw new DigestError('INVALID_SOURCE', 'Source must be an AsyncIterable');
    for await (const chunk of source) {
      if (options.signal?.aborted) throw new DigestError('CANCELLED', 'HMAC cancelled', { statusCode: 499, operation: 'hmac' });
      const buffer = toBuffer(chunk);
      if (buffer.byteLength > config.maxChunkBytes) throw new DigestError('CHUNK_TOO_LARGE', `Chunk exceeds ${config.maxChunkBytes} bytes`, { statusCode: 413, operation: 'hmac' });
      total += buffer.byteLength;
      if (total > config.maxTotalBytes) throw new DigestError('INPUT_TOO_LARGE', `Total input exceeds ${config.maxTotalBytes} bytes`, { statusCode: 413, operation: 'hmac' });
      hmac.update(buffer);
    }
    return Buffer.from(hmac.digest());
  } catch (cause) {
    if (cause instanceof DigestError) throw cause;
    throw new DigestError('HMAC_FAILED', 'Async HMAC operation failed', { cause, operation: 'hmac' });
  }
}

export function constantTimeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) throw new DigestError('INVALID_INPUT', 'Values must be Uint8Array instances');
  if (a.byteLength !== b.byteLength) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
  catch (cause) { throw new DigestError('COMPARE_FAILED', 'Constant-time comparison failed', { cause, operation: 'compare' }); }
}

export { DEFAULT_MAX_INPUT_BYTES, DEFAULT_MAX_CHUNK_BYTES, DEFAULT_MAX_TOTAL_BYTES };
