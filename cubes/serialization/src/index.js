const MAGIC = Uint8Array.from([0x53, 0x4c, 0x42, 0x43]); // SLBC
const VERSION = 1;

const TAG_NULL = 0x00;
const TAG_FALSE = 0x01;
const TAG_TRUE = 0x02;
const TAG_NUMBER = 0x03;
const TAG_STRING = 0x04;
const TAG_ARRAY = 0x05;
const TAG_OBJECT = 0x06;

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_DEPTH = 64;
const DEFAULT_MAX_COLLECTION_ITEMS = 100_000;
const DEFAULT_MAX_STRING_BYTES = 1 * 1024 * 1024;

export class SerializationError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'SerializationError';
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    this.offset = options.offset ?? null;
    Object.freeze(this);
  }
}

function assertLimit(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new SerializationError('INVALID_LIMIT', `${name} must be a safe integer >= 1`);
}

function normalizeOptions(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new SerializationError('INVALID_OPTIONS', 'Serialization options must be an object');
  const config = {
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxCollectionItems: options.maxCollectionItems ?? DEFAULT_MAX_COLLECTION_ITEMS,
    maxStringBytes: options.maxStringBytes ?? DEFAULT_MAX_STRING_BYTES,
  };
  Object.entries(config).forEach(([name, value]) => assertLimit(value, name));
  return Object.freeze(config);
}

class Writer {
  constructor(maxBytes) {
    this.maxBytes = maxBytes;
    this.buffer = Buffer.allocUnsafe(Math.min(1024, maxBytes));
    this.offset = 0;
  }

  ensure(length) {
    if (!Number.isSafeInteger(length) || length < 0 || this.offset + length > this.maxBytes) {
      throw new SerializationError('PAYLOAD_TOO_LARGE', `Encoded payload exceeds ${this.maxBytes} bytes`, { statusCode: 413 });
    }
    if (this.offset + length <= this.buffer.length) return;
    let next = this.buffer.length;
    while (next < this.offset + length) next = Math.min(this.maxBytes, Math.max(next * 2, 1024));
    const replacement = Buffer.allocUnsafe(next);
    this.buffer.copy(replacement, 0, 0, this.offset);
    this.buffer = replacement;
  }

  u8(value) {
    this.ensure(1);
    this.buffer.writeUInt8(value, this.offset);
    this.offset += 1;
  }

  u32(value) {
    this.ensure(4);
    this.buffer.writeUInt32BE(value, this.offset);
    this.offset += 4;
  }

  f64(value) {
    this.ensure(8);
    this.buffer.writeDoubleBE(value, this.offset);
    this.offset += 8;
  }

  bytes(value) {
    this.ensure(value.byteLength);
    Buffer.from(value).copy(this.buffer, this.offset);
    this.offset += value.byteLength;
  }

  finish() {
    return Buffer.from(this.buffer.subarray(0, this.offset));
  }
}

class Reader {
  constructor(input, maxBytes) {
    if (!(input instanceof Uint8Array)) throw new SerializationError('INVALID_INPUT', 'Decode input must be a Uint8Array');
    if (input.byteLength > maxBytes) throw new SerializationError('PAYLOAD_TOO_LARGE', `Encoded input exceeds ${maxBytes} bytes`, { statusCode: 413 });
    this.buffer = Buffer.from(input);
    this.offset = 0;
  }

  remaining() { return this.buffer.length - this.offset; }

  need(length) {
    if (this.remaining() < length) throw new SerializationError('TRUNCATED_INPUT', 'Input ended before the value was complete', { offset: this.offset });
  }

  u8() { this.need(1); const value = this.buffer.readUInt8(this.offset); this.offset += 1; return value; }
  u32() { this.need(4); const value = this.buffer.readUInt32BE(this.offset); this.offset += 4; return value; }
  f64() { this.need(8); const value = this.buffer.readDoubleBE(this.offset); this.offset += 8; return value; }
  bytes(length) { this.need(length); const value = this.buffer.subarray(this.offset, this.offset + length); this.offset += length; return value; }
}

function utf8Bytes(value) { return Buffer.from(value, 'utf8'); }

function encodeValue(writer, value, config, depth) {
  if (depth > config.maxDepth) throw new SerializationError('MAX_DEPTH_EXCEEDED', `Maximum nesting depth ${config.maxDepth} exceeded`, { statusCode: 413 });

  if (value === null) { writer.u8(TAG_NULL); return; }
  if (value === false) { writer.u8(TAG_FALSE); return; }
  if (value === true) { writer.u8(TAG_TRUE); return; }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new SerializationError('UNSUPPORTED_VALUE', 'Only finite numbers are supported');
    writer.u8(TAG_NUMBER);
    writer.f64(value);
    return;
  }

  if (typeof value === 'string') {
    const bytes = utf8Bytes(value);
    if (bytes.byteLength > config.maxStringBytes) throw new SerializationError('STRING_TOO_LARGE', `String exceeds ${config.maxStringBytes} bytes`, { statusCode: 413 });
    writer.u8(TAG_STRING);
    writer.u32(bytes.byteLength);
    writer.bytes(bytes);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > config.maxCollectionItems) throw new SerializationError('COLLECTION_TOO_LARGE', `Array exceeds ${config.maxCollectionItems} items`, { statusCode: 413 });
    writer.u8(TAG_ARRAY);
    writer.u32(value.length);
    for (const item of value) encodeValue(writer, item, config, depth + 1);
    return;
  }

  if (typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new SerializationError('UNSUPPORTED_VALUE', 'Only plain objects are supported');
    }
    const keys = Object.keys(value).sort();
    if (keys.length > config.maxCollectionItems) throw new SerializationError('COLLECTION_TOO_LARGE', `Object exceeds ${config.maxCollectionItems} properties`, { statusCode: 413 });
    writer.u8(TAG_OBJECT);
    writer.u32(keys.length);
    for (const key of keys) {
      const keyBytes = utf8Bytes(key);
      if (keyBytes.byteLength > config.maxStringBytes) throw new SerializationError('STRING_TOO_LARGE', 'Object key exceeds string limit', { statusCode: 413 });
      writer.u32(keyBytes.byteLength);
      writer.bytes(keyBytes);
      encodeValue(writer, value[key], config, depth + 1);
    }
    return;
  }

  throw new SerializationError('UNSUPPORTED_VALUE', `Unsupported value type: ${typeof value}`);
}

function decodeValue(reader, config, depth) {
  if (depth > config.maxDepth) throw new SerializationError('MAX_DEPTH_EXCEEDED', `Maximum nesting depth ${config.maxDepth} exceeded`, { statusCode: 413, offset: reader.offset });
  const tag = reader.u8();
  switch (tag) {
    case TAG_NULL: return null;
    case TAG_FALSE: return false;
    case TAG_TRUE: return true;
    case TAG_NUMBER: {
      const value = reader.f64();
      if (!Number.isFinite(value)) throw new SerializationError('INVALID_NUMBER', 'Decoded number is not finite', { offset: reader.offset - 8 });
      return value;
    }
    case TAG_STRING: {
      const length = reader.u32();
      if (length > config.maxStringBytes) throw new SerializationError('STRING_TOO_LARGE', 'Decoded string exceeds configured limit', { statusCode: 413, offset: reader.offset - 4 });
      return new TextDecoder('utf-8', { fatal: true }).decode(reader.bytes(length));
    }
    case TAG_ARRAY: {
      const length = reader.u32();
      if (length > config.maxCollectionItems) throw new SerializationError('COLLECTION_TOO_LARGE', 'Decoded array exceeds configured limit', { statusCode: 413, offset: reader.offset - 4 });
      const result = new Array(length);
      for (let index = 0; index < length; index += 1) result[index] = decodeValue(reader, config, depth + 1);
      return result;
    }
    case TAG_OBJECT: {
      const length = reader.u32();
      if (length > config.maxCollectionItems) throw new SerializationError('COLLECTION_TOO_LARGE', 'Decoded object exceeds configured limit', { statusCode: 413, offset: reader.offset - 4 });
      const entries = [];
      const seen = new Set();
      for (let index = 0; index < length; index += 1) {
        const keyLength = reader.u32();
        if (keyLength > config.maxStringBytes) throw new SerializationError('STRING_TOO_LARGE', 'Decoded object key exceeds configured limit', { statusCode: 413, offset: reader.offset - 4 });
        const key = new TextDecoder('utf-8', { fatal: true }).decode(reader.bytes(keyLength));
        if (seen.has(key)) throw new SerializationError('DUPLICATE_KEY', `Duplicate object key: ${key}`, { offset: reader.offset - keyLength });
        seen.add(key);
        entries.push([key, decodeValue(reader, config, depth + 1)]);
      }
      return Object.fromEntries(entries);
    }
    default:
      throw new SerializationError('INVALID_TAG', `Unknown type tag: ${tag}`, { offset: reader.offset - 1 });
  }
}

export function createSerializationConfig(options = {}) { return normalizeOptions(options); }

export function encode(value, options = {}) {
  const config = normalizeOptions(options);
  const writer = new Writer(config.maxBytes);
  writer.bytes(MAGIC);
  writer.u8(VERSION);
  encodeValue(writer, value, config, 0);
  return writer.finish();
}

export function decode(input, options = {}) {
  const config = normalizeOptions(options);
  const reader = new Reader(input, config.maxBytes);
  const magic = reader.bytes(MAGIC.length);
  for (let index = 0; index < MAGIC.length; index += 1) if (magic[index] !== MAGIC[index]) throw new SerializationError('INVALID_HEADER', 'Invalid serialization magic', { offset: 0 });
  const version = reader.u8();
  if (version !== VERSION) throw new SerializationError('UNSUPPORTED_VERSION', `Unsupported serialization version: ${version}`, { offset: MAGIC.length });
  const value = decodeValue(reader, config, 0);
  if (reader.remaining() !== 0) throw new SerializationError('TRAILING_BYTES', 'Input contains trailing bytes', { offset: reader.offset });
  return value;
}

export { DEFAULT_MAX_BYTES, DEFAULT_MAX_DEPTH, DEFAULT_MAX_COLLECTION_ITEMS, DEFAULT_MAX_STRING_BYTES, MAGIC, VERSION };
