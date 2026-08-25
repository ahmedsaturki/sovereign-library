import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_LIMITS = Object.freeze({
  maxSnapshotBytes: 4 * 1024 * 1024,
  maxPayloadBytes: 2 * 1024 * 1024,
  maxDepth: 32,
  maxEntries: 100_000,
  maxPathBytes: 4096,
  maxMetadataBytes: 16 * 1024,
});

class SnapshotError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'SnapshotError';
    this.code = code;
    this.path = options.path ?? null;
    Object.freeze(this);
  }
}

const fail = (code, message, options = {}) => { throw new SnapshotError(code, message, options); };
const objectLike = (value) => value !== null && typeof value === 'object';

function assertDataProperties(value, label) {
  if (!objectLike(value) || Array.isArray(value)) fail('INVALID_CONFIG', `${label} must be an object`);
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_CONFIG', `${label} contains an accessor property`);
  }
}

function validateLimits(input = {}) {
  assertDataProperties(input, 'limits');
  const limits = Object.freeze({ ...DEFAULT_LIMITS, ...input });
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_CONFIG', `${key} must be a positive safe integer`);
  }
  return limits;
}

function assertNoAccessors(value, depth, limits, seen = new Set(), entries = { value: 0 }) {
  if (!objectLike(value)) return;
  if (depth > limits.maxDepth) fail('LIMIT_EXCEEDED', 'Maximum snapshot depth exceeded');
  if (seen.has(value)) fail('UNSUPPORTED_VALUE', 'Circular structures are not supported');
  seen.add(value);
  for (const key of Object.keys(value)) {
    entries.value += 1;
    if (entries.value > limits.maxEntries) fail('LIMIT_EXCEEDED', 'Maximum snapshot entries exceeded');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('UNSUPPORTED_VALUE', 'Accessor properties are not supported');
    assertNoAccessors(descriptor.value, depth + 1, limits, seen, entries);
  }
  seen.delete(value);
}

function canonicalJson(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('UNSUPPORTED_VALUE', 'Non-finite numbers are not supported');
    if (Object.is(value, -0)) return '-0';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (objectLike(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  fail('UNSUPPORTED_VALUE', 'Value is not snapshot-compatible');
}

function cloneFrozen(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(cloneFrozen));
  if (objectLike(value)) {
    const copy = Object.create(Object.getPrototypeOf(value) === null ? null : Object.prototype);
    for (const key of Object.keys(value)) copy[key] = cloneFrozen(value[key]);
    return Object.freeze(copy);
  }
  return value;
}

function encodePayload(payload, limits) {
  assertNoAccessors(payload, 0, limits);
  const json = canonicalJson(payload);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > limits.maxPayloadBytes) fail('LIMIT_EXCEEDED', 'Payload exceeds configured limit');
  return { json, bytes };
}

function buildEnvelope(payload, metadata, limits, algorithm) {
  const encoded = encodePayload(payload, limits);
  const safeMetadata = metadata ?? {};
  assertDataProperties(safeMetadata, 'metadata');
  assertNoAccessors(safeMetadata, 0, limits);
  const metadataJson = canonicalJson(safeMetadata);
  if (Buffer.byteLength(metadataJson, 'utf8') > limits.maxMetadataBytes) fail('LIMIT_EXCEEDED', 'Metadata exceeds configured limit');
  const body = `SLIBSNAP\n1\n${algorithm}\n${metadataJson}\n${encoded.json}`;
  const checksum = crypto.createHash(algorithm).update(body).digest('hex');
  const envelope = `${body}\n${checksum}\n`;
  if (Buffer.byteLength(envelope, 'utf8') > limits.maxSnapshotBytes) fail('LIMIT_EXCEEDED', 'Snapshot exceeds configured limit');
  return envelope;
}

function decodeEnvelope(text, limits, expectedAlgorithm) {
  if (Buffer.byteLength(text, 'utf8') > limits.maxSnapshotBytes) fail('LIMIT_EXCEEDED', 'Snapshot exceeds configured limit');
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length !== 6) fail('MALFORMED_SNAPSHOT', 'Snapshot envelope is malformed');
  const [magic, version, algorithm, metadataJson, payloadJson, checksum] = lines;
  if (magic !== 'SLIBSNAP') fail('UNSUPPORTED_FORMAT', 'Snapshot format identifier is invalid');
  if (version !== '1') fail('UNSUPPORTED_VERSION', `Unsupported snapshot version ${version}`);
  if (algorithm !== expectedAlgorithm) fail('UNSUPPORTED_FORMAT', 'Snapshot checksum algorithm is not supported');
  const body = `SLIBSNAP\n${version}\n${algorithm}\n${metadataJson}\n${payloadJson}`;
  const expected = crypto.createHash(algorithm).update(body).digest('hex');
  const actual = String(checksum);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) fail('INTEGRITY_FAILURE', 'Snapshot integrity verification failed');
  let metadata;
  let payload;
  try {
    metadata = JSON.parse(metadataJson);
    payload = JSON.parse(payloadJson);
  } catch (cause) {
    fail('MALFORMED_SNAPSHOT', 'Snapshot payload is not valid JSON', { cause });
  }
  assertDataProperties(metadata, 'metadata');
  encodePayload(payload, limits);
  return Object.freeze({ format: 'SLIBSNAP', version: 1, algorithm, metadata: cloneFrozen(metadata), payload: cloneFrozen(payload), checksum: expected });
}

function safePath(filePath, limits) {
  if (typeof filePath !== 'string' || filePath.length === 0) fail('INVALID_PATH', 'Snapshot path must be a non-empty string');
  if (Buffer.byteLength(filePath, 'utf8') > limits.maxPathBytes) fail('LIMIT_EXCEEDED', 'Snapshot path exceeds configured limit');
  return path.resolve(filePath);
}

function createSnapshotStore(config = {}) {
  assertDataProperties(config, 'config');
  const limitsValue = config.limits ?? {};
  const limits = validateLimits(limitsValue);
  const algorithm = config.algorithm ?? 'sha256';
  if (!['sha256', 'sha512'].includes(algorithm)) fail('INVALID_CONFIG', 'Unsupported checksum algorithm');
  let mutationSequence = 0;

  function create(payload, metadata = {}) {
    const envelope = buildEnvelope(payload, metadata, limits, algorithm);
    return Object.freeze({ bytes: Buffer.byteLength(envelope, 'utf8'), algorithm, envelope, checksum: envelope.trimEnd().split('\n').at(-1) });
  }

  async function save(filePath, payload, metadata = {}) {
    const target = safePath(filePath, limits);
    const snapshot = create(payload, metadata);
    try {
      const token = `${process.pid}-${Date.now()}-${mutationSequence++}`;
      const dir = path.dirname(target);
      const base = path.basename(target);
      await fs.mkdir(dir, { recursive: true });
      const temp = path.join(dir, `.${base}.${token}.tmp`);
      let committed = false;
      try {
        await fs.writeFile(temp, snapshot.envelope, { flag: 'wx', mode: 0o600 });
        await fs.rename(temp, target);
        committed = true;
      } finally {
        if (!committed) {
          try { await fs.rm(temp, { force: true }); } catch {}
        }
      }
      return Object.freeze({ path: target, bytes: snapshot.bytes, checksum: snapshot.checksum });
    } catch (cause) {
      if (cause instanceof SnapshotError) throw cause;
      throw new SnapshotError('IO_FAILURE', 'Snapshot save failed', { path: target, cause });
    }
  }

  async function load(filePath) {
    const target = safePath(filePath, limits);
    try {
      const content = await fs.readFile(target, 'utf8');
      return decodeEnvelope(content, limits, algorithm);
    } catch (error) {
      if (error instanceof SnapshotError) throw error;
      if (error?.code === 'ENOENT') throw new SnapshotError('NOT_FOUND', 'Snapshot file does not exist', { path: target, cause: error });
      throw new SnapshotError('IO_FAILURE', 'Snapshot load failed', { path: target, cause: error });
    }
  }

  return Object.freeze({ limits, algorithm, create, save, load });
}

export { DEFAULT_LIMITS, SnapshotError, createSnapshotStore };
