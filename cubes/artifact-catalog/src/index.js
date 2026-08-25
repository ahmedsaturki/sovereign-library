import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAGIC = 'SAC1';
const DEFAULT_LIMITS = Object.freeze({
  maxRecords: 4096,
  maxIdentifierBytes: 256,
  maxPackageBytes: 512,
  maxVersionBytes: 256,
  maxTagBytes: 256,
  maxMetadataBytes: 16 * 1024,
  maxResults: 1024,
  maxSerializedBytes: 4 * 1024 * 1024,
});

class ArtifactCatalogError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ArtifactCatalogError';
    this.code = code;
    Object.freeze(this);
  }
}

const fail = (code, message) => { throw new ArtifactCatalogError(code, message); };
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const byteLength = (value) => Buffer.byteLength(value, 'utf8');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function rejectAccessors(value, label) {
  if (!isRecord(value)) fail('INVALID_DEFINITION', `${label} must be an object`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key === 'symbol' || !descriptor || !('value' in descriptor)) fail('INVALID_DEFINITION', `${label} contains an accessor or symbol key`);
  }
}

function stableJsonValue(value, label = 'value') {
  if (Array.isArray(value)) return value.map((item, index) => stableJsonValue(item, `${label}[${index}]`));
  if (isRecord(value)) {
    rejectAccessors(value, label);
    const output = {};
    for (const key of Object.getOwnPropertyNames(value).sort()) output[key] = stableJsonValue(value[key], `${label}.${key}`);
    return output;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  fail('UNSUPPORTED_VALUE', `${label} contains an unsupported value`);
}

function limitsOf(input = {}) {
  rejectAccessors(input, 'limits');
  const limits = { ...DEFAULT_LIMITS, ...input };
  for (const value of Object.values(limits)) if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_LIMIT', 'Invalid catalog limit');
  return Object.freeze(limits);
}

function text(value, label, maxBytes) {
  if (typeof value !== 'string' || !value) fail('INVALID_FIELD', `${label} must be a non-empty string`);
  if (byteLength(value) > maxBytes) fail('LIMIT_EXCEEDED', `${label} exceeds limit`);
  return value;
}

function normalizeTags(value, limits) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) fail('INVALID_FIELD', 'tags must be an array');
  const normalized = value.map((tag) => text(tag, 'tag', limits.maxTagBytes));
  const unique = [...new Set(normalized)].sort();
  return Object.freeze(unique);
}

function normalizeMetadata(value, limits) {
  const normalized = stableJsonValue(value ?? {}, 'metadata');
  const serialized = JSON.stringify(normalized);
  if (byteLength(serialized) > limits.maxMetadataBytes) fail('LIMIT_EXCEEDED', 'metadata exceeds limit');
  return normalized;
}

function normalizeRecord(input, limits) {
  rejectAccessors(input, 'record');
  const identifier = text(input.identifier, 'identifier', limits.maxIdentifierBytes);
  const packageName = text(input.packageName, 'packageName', limits.maxPackageBytes);
  const version = text(input.version, 'version', limits.maxVersionBytes);
  const digest = text(input.digest, 'digest', 128);
  if (!/^[0-9a-f]{64}$/.test(digest)) fail('INVALID_FIELD', 'digest must be lowercase SHA-256');
  const tags = normalizeTags(input.tags, limits);
  const metadata = normalizeMetadata(input.metadata, limits);
  return Object.freeze({ identifier, packageName, version, digest, tags, metadata });
}

function canonicalRecords(records, limits) {
  if (!Array.isArray(records) || records.length > limits.maxRecords) fail('LIMIT_EXCEEDED', 'record count exceeds limit');
  const normalized = records.map((record) => normalizeRecord(record, limits));
  const seen = new Set();
  for (const record of normalized) {
    if (seen.has(record.identifier)) fail('DUPLICATE_RECORD', `duplicate identifier: ${record.identifier}`);
    seen.add(record.identifier);
  }
  normalized.sort((a, b) => a.identifier.localeCompare(b.identifier, 'en', { numeric: false }));
  return Object.freeze(normalized);
}

function serializeState(records, limits) {
  const canonical = { format: MAGIC, version: 1, records: records.map((record) => ({ ...record })) };
  const payload = JSON.stringify(canonical);
  if (byteLength(payload) > limits.maxSerializedBytes) fail('LIMIT_EXCEEDED', 'catalog exceeds serialized size limit');
  const checksum = sha256(payload);
  return Buffer.from(`${MAGIC}\n${JSON.stringify({ ...canonical, checksum })}\n`, 'utf8');
}

function parseState(raw, limits) {
  if (!(raw instanceof Uint8Array)) fail('UNSUPPORTED_VALUE', 'serialized catalog must be bytes');
  if (raw.byteLength > limits.maxSerializedBytes) fail('LIMIT_EXCEEDED', 'catalog exceeds serialized size limit');
  const textValue = Buffer.from(raw).toString('utf8');
  if (!textValue.startsWith(`${MAGIC}\n`)) fail('INVALID_CATALOG', 'invalid catalog header');
  let parsed;
  try { parsed = JSON.parse(textValue.slice(MAGIC.length + 1).trimEnd()); } catch { fail('INVALID_CATALOG', 'malformed catalog JSON'); }
  rejectAccessors(parsed, 'catalog');
  if (parsed.format !== MAGIC || parsed.version !== 1 || !Array.isArray(parsed.records) || typeof parsed.checksum !== 'string') fail('INVALID_CATALOG', 'unsupported catalog format');
  const unsigned = { format: parsed.format, version: parsed.version, records: parsed.records };
  const expected = sha256(JSON.stringify(unsigned));
  if (parsed.checksum !== expected) fail('CORRUPT_CATALOG', 'catalog checksum mismatch');
  return canonicalRecords(parsed.records, limits);
}

class ArtifactCatalog {
  constructor(options = {}) {
    rejectAccessors(options, 'options');
    this.limits = limitsOf(options.limits ?? {});
    this.file = options.file ? path.resolve(options.file) : null;
    this.records = new Map();
    this.closed = false;
  }

  _assertOpen() { if (this.closed) fail('CLOSED', 'catalog is closed'); }
  _snapshotArray() { return Object.freeze([...this.records.values()].sort((a, b) => a.identifier.localeCompare(b.identifier, 'en', { numeric: false }))); }

  async open() {
    this._assertOpen();
    if (this.file) {
      try { const raw = await fs.readFile(this.file); for (const record of parseState(raw, this.limits)) this.records.set(record.identifier, record); }
      catch (error) { if (error?.code !== 'ENOENT') throw error; }
    }
    return this;
  }

  close() { this.closed = true; }

  async _persist(records) {
    if (!this.file) return;
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const serialized = serializeState(records, this.limits);
    const temp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temp, serialized, { flag: 'wx' });
    try { await fs.rename(temp, this.file); }
    catch (error) { try { await fs.unlink(temp); } catch {} throw error; }
  }

  async add(input) {
    this._assertOpen();
    const record = normalizeRecord(input, this.limits);
    if (this.records.has(record.identifier)) fail('DUPLICATE_RECORD', `duplicate identifier: ${record.identifier}`);
    const next = new Map(this.records); next.set(record.identifier, record);
    if (next.size > this.limits.maxRecords) fail('LIMIT_EXCEEDED', 'record count exceeds limit');
    const snapshot = canonicalRecords([...next.values()], this.limits);
    await this._persist(snapshot);
    this.records = next;
    return record;
  }

  async update(input) {
    this._assertOpen();
    const record = normalizeRecord(input, this.limits);
    if (!this.records.has(record.identifier)) fail('NOT_FOUND', `identifier not found: ${record.identifier}`);
    const next = new Map(this.records); next.set(record.identifier, record);
    const snapshot = canonicalRecords([...next.values()], this.limits);
    await this._persist(snapshot);
    this.records = next;
    return record;
  }

  async remove(identifier) {
    this._assertOpen();
    const key = text(identifier, 'identifier', this.limits.maxIdentifierBytes);
    if (!this.records.has(key)) return false;
    const next = new Map(this.records); next.delete(key);
    const snapshot = canonicalRecords([...next.values()], this.limits);
    await this._persist(snapshot);
    this.records = next;
    return true;
  }

  get(identifier) {
    this._assertOpen();
    const key = text(identifier, 'identifier', this.limits.maxIdentifierBytes);
    return this.records.get(key) ?? null;
  }

  query(options = {}) {
    this._assertOpen();
    rejectAccessors(options, 'query');
    const maxResults = options.limit === undefined ? this.limits.maxResults : Math.min(options.limit, this.limits.maxResults);
    if (!Number.isSafeInteger(maxResults) || maxResults < 1) fail('INVALID_LIMIT', 'invalid query result limit');
    const prefix = options.prefix === undefined ? null : text(options.prefix, 'prefix', this.limits.maxIdentifierBytes);
    const packageName = options.packageName === undefined ? null : text(options.packageName, 'packageName', this.limits.maxPackageBytes);
    const version = options.version === undefined ? null : text(options.version, 'version', this.limits.maxVersionBytes);
    const tag = options.tag === undefined ? null : text(options.tag, 'tag', this.limits.maxTagBytes);
    const exact = options.identifier === undefined ? null : text(options.identifier, 'identifier', this.limits.maxIdentifierBytes);
    const results = this._snapshotArray().filter((record) => {
      if (exact !== null && record.identifier !== exact) return false;
      if (prefix !== null && !record.identifier.startsWith(prefix)) return false;
      if (packageName !== null && record.packageName !== packageName) return false;
      if (version !== null && record.version !== version) return false;
      if (tag !== null && !record.tags.includes(tag)) return false;
      return true;
    });
    if (results.length > maxResults) return Object.freeze(results.slice(0, maxResults));
    return Object.freeze(results);
  }

  snapshot() {
    this._assertOpen();
    return Object.freeze({ format: MAGIC, version: 1, records: this._snapshotArray() });
  }

  serialize() {
    this._assertOpen();
    return serializeState(this._snapshotArray(), this.limits);
  }

  restore(serialized) {
    this._assertOpen();
    const records = parseState(serialized, this.limits);
    const next = new Map(records.map((record) => [record.identifier, record]));
    this.records = next;
  }
}

export { MAGIC, DEFAULT_LIMITS, ArtifactCatalogError, ArtifactCatalog, parseState, serializeState };
