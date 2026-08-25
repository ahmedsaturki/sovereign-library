import { gzip as gzipNative, gunzip as gunzipNative, deflate as deflateNative, inflate as inflateNative, gzipSync as gzipNativeSync, gunzipSync as gunzipNativeSync, deflateSync as deflateNativeSync, inflateSync as inflateNativeSync } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzipNative);
const gunzipAsync = promisify(gunzipNative);
const deflateAsync = promisify(deflateNative);
const inflateAsync = promisify(inflateNative);

const DEFAULT_MAX_INPUT_BYTES = 1_048_576;
const DEFAULT_MAX_OUTPUT_BYTES = 8_388_608;

export class CompressionError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'CompressionError';
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    this.operation = options.operation ?? null;
    Object.freeze(this);
  }
}

function assertLimit(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CompressionError('INVALID_LIMIT', `${name} must be a safe integer >= 1`);
  }
}

function normalizeOptions(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new CompressionError('INVALID_OPTIONS', 'Compression options must be an object');
  }
  const maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  assertLimit(maxInputBytes, 'maxInputBytes');
  assertLimit(maxOutputBytes, 'maxOutputBytes');
  return Object.freeze({ maxInputBytes, maxOutputBytes });
}

export function createCompressionConfig(options = {}) {
  return normalizeOptions(options);
}

function toBuffer(input) {
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  throw new CompressionError('INVALID_INPUT', 'Input must be a string, Buffer, or Uint8Array');
}

function assertInputSize(buffer, options, operation) {
  if (buffer.byteLength > options.maxInputBytes) {
    throw new CompressionError('INPUT_TOO_LARGE', `${operation} input exceeds ${options.maxInputBytes} bytes`, { operation, statusCode: 413 });
  }
}

function assertOutputSize(buffer, options, operation) {
  if (buffer.byteLength > options.maxOutputBytes) {
    throw new CompressionError('OUTPUT_TOO_LARGE', `${operation} output exceeds ${options.maxOutputBytes} bytes`, { operation, statusCode: 413 });
  }
}

function normalizeZlibError(cause, operation) {
  const code = cause?.code === 'ERR_BUFFER_TOO_LARGE' ? 'OUTPUT_TOO_LARGE' : `${operation.toUpperCase()}_FAILED`;
  const message = code === 'OUTPUT_TOO_LARGE' ? 'Decompression output exceeded configured maximum size' : `${operation} failed`;
  return new CompressionError(code, message, { cause, operation, statusCode: code === 'OUTPUT_TOO_LARGE' ? 413 : 400 });
}

function syncOperation(nativeFn, input, options, operation) {
  const config = normalizeOptions(options);
  const buffer = toBuffer(input);
  assertInputSize(buffer, config, operation);
  try {
    const result = nativeFn(buffer, operation === 'decompress' ? { maxOutputLength: config.maxOutputBytes } : undefined);
    assertOutputSize(result, config, operation);
    return Buffer.from(result);
  } catch (cause) {
    if (cause instanceof CompressionError) throw cause;
    throw normalizeZlibError(cause, operation);
  }
}

async function asyncOperation(nativeFn, input, options, operation) {
  const config = normalizeOptions(options);
  const buffer = toBuffer(input);
  assertInputSize(buffer, config, operation);
  try {
    const result = operation === 'decompress'
      ? await nativeFn(buffer, { maxOutputLength: config.maxOutputBytes })
      : await nativeFn(buffer);
    assertOutputSize(result, config, operation);
    return Buffer.from(result);
  } catch (cause) {
    if (cause instanceof CompressionError) throw cause;
    throw normalizeZlibError(cause, operation);
  }
}

export function gzipSync(input, options = {}) { return syncOperation(gzipNativeSync, input, options, 'compress'); }
export function gunzipSync(input, options = {}) { return syncOperation(gunzipNativeSync, input, options, 'decompress'); }
export function deflateSync(input, options = {}) { return syncOperation(deflateNativeSync, input, options, 'compress'); }
export function inflateSync(input, options = {}) { return syncOperation(inflateNativeSync, input, options, 'decompress'); }
export function gzip(input, options = {}) { return asyncOperation(gzipAsync, input, options, 'compress'); }
export function gunzip(input, options = {}) { return asyncOperation(gunzipAsync, input, options, 'decompress'); }
export function deflate(input, options = {}) { return asyncOperation(deflateAsync, input, options, 'compress'); }
export function inflate(input, options = {}) { return asyncOperation(inflateAsync, input, options, 'decompress'); }

export function compress(input, options = {}) {
  const format = options?.format ?? 'gzip';
  if (format === 'gzip') return gzip(input, options);
  if (format === 'deflate') return deflate(input, options);
  return Promise.reject(new CompressionError('INVALID_FORMAT', `Unsupported compression format: ${String(format)}`));
}

export function decompress(input, options = {}) {
  const format = options?.format ?? 'gzip';
  if (format === 'gzip') return gunzip(input, options);
  if (format === 'deflate') return inflate(input, options);
  return Promise.reject(new CompressionError('INVALID_FORMAT', `Unsupported compression format: ${String(format)}`));
}

export { DEFAULT_MAX_INPUT_BYTES, DEFAULT_MAX_OUTPUT_BYTES };
