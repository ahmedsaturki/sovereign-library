import { createHash } from 'node:crypto';

const DEFAULT_LIMITS = Object.freeze({
  maxEntries: 4096,
  maxPathBytes: 1024,
  maxContentBytes: 16 * 1024 * 1024,
  maxManifestBytes: 4 * 1024 * 1024,
});

class ManifestIntegrityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ManifestIntegrityError';
    this.code = code;
    Object.freeze(this);
  }
}

const fail = (code, message) => { throw new ManifestIntegrityError(code, message); };
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const byteLength = (value) => Buffer.byteLength(value, 'utf8');

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) fail('INVALID_DEFINITION', `${label} must be an object`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_DEFINITION', `${label} contains accessor property`);
  }
}

function normalizeLimits(input = {}) {
  assertPlainObject(input, 'limits');
  const limits = Object.freeze({ ...DEFAULT_LIMITS, ...input });
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_DEFINITION', `Invalid limit: ${key}`);
  }
  return limits;
}

function normalizePath(value, limits) {
  if (typeof value !== 'string' || !value) fail('INVALID_PATH', 'Path must be a non-empty string');
  if (value.includes('\\')) fail('INVALID_PATH', 'Backslash is not allowed in manifest paths');
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) fail('INVALID_PATH', 'Absolute paths are not allowed');
  if (byteLength(value) > limits.maxPathBytes) fail('LIMIT_EXCEEDED', 'Path exceeds limit');
  const parts = value.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) fail('INVALID_PATH', 'Path contains an unsafe segment');
  return value;
}

function toBytes(content, limits) {
  let bytes;
  if (typeof content === 'string') bytes = Buffer.from(content, 'utf8');
  else if (content instanceof Uint8Array) bytes = Buffer.from(content);
  else fail('UNSUPPORTED_VALUE', 'Content must be a string or Uint8Array');
  if (bytes.byteLength > limits.maxContentBytes) fail('LIMIT_EXCEEDED', 'Content exceeds limit');
  return bytes;
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function descriptor(entry, limits) {
  assertPlainObject(entry, 'entry');
  const path = normalizePath(entry.path, limits);
  const content = toBytes(entry.content, limits);
  return Object.freeze({ path, bytes: content.byteLength, sha256: digest(content) });
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function stableManifest(entries, limits) {
  if (!Array.isArray(entries) || entries.length > limits.maxEntries) fail('INVALID_DEFINITION', 'Invalid entry collection');
  const seen = new Set();
  const descriptors = entries.map((entry) => descriptor(entry, limits));
  for (const entry of descriptors) {
    if (seen.has(entry.path)) fail('DUPLICATE_PATH', `Duplicate path: ${entry.path}`);
    seen.add(entry.path);
  }
  descriptors.sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: false }));
  const manifest = { version: 1, entries: descriptors };
  const bytes = byteLength(JSON.stringify(manifest));
  if (bytes > limits.maxManifestBytes) fail('LIMIT_EXCEEDED', 'Manifest exceeds size limit');
  return deepFreeze(manifest);
}

function validateManifest(manifest, limits) {
  assertPlainObject(manifest, 'manifest');
  if (manifest.version !== 1 || !Array.isArray(manifest.entries)) fail('INVALID_MANIFEST', 'Unsupported manifest version or entries');
  if (manifest.entries.length > limits.maxEntries) fail('LIMIT_EXCEEDED', 'Manifest entry count exceeds limit');
  const seen = new Set();
  const normalized = manifest.entries.map((entry) => {
    assertPlainObject(entry, 'manifest entry');
    const path = normalizePath(entry.path, limits);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) fail('INVALID_MANIFEST', `Invalid byte count for ${path}`);
    if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) fail('INVALID_MANIFEST', `Invalid digest for ${path}`);
    if (seen.has(path)) fail('DUPLICATE_PATH', `Duplicate path: ${path}`);
    seen.add(path);
    return { path, bytes: entry.bytes, sha256: entry.sha256 };
  });
  normalized.sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: false }));
  const canonical = { version: 1, entries: normalized };
  if (byteLength(JSON.stringify(canonical)) > limits.maxManifestBytes) fail('LIMIT_EXCEEDED', 'Manifest exceeds size limit');
  return canonical;
}

function createManifest(entries, options = {}) {
  assertPlainObject(options, 'options');
  return stableManifest(entries, normalizeLimits(options.limits ?? {}));
}

function verifyManifest(manifest, entries, options = {}) {
  assertPlainObject(options, 'options');
  const limits = normalizeLimits(options.limits ?? {});
  const expected = validateManifest(manifest, limits);
  const actual = stableManifest(entries, limits);
  const expectedMap = new Map(expected.entries.map((entry) => [entry.path, entry]));
  const actualMap = new Map(actual.entries.map((entry) => [entry.path, entry]));
  const missing = [];
  const extra = [];
  const mismatched = [];
  for (const entry of expected.entries) {
    const current = actualMap.get(entry.path);
    if (!current) { missing.push(entry.path); continue; }
    if (current.bytes !== entry.bytes || current.sha256 !== entry.sha256) {
      mismatched.push({ path: entry.path, expected: { bytes: entry.bytes, sha256: entry.sha256 }, actual: { bytes: current.bytes, sha256: current.sha256 } });
    }
  }
  for (const entry of actual.entries) if (!expectedMap.has(entry.path)) extra.push(entry.path);
  missing.sort(); extra.sort(); mismatched.sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: false }));
  return deepFreeze({ ok: missing.length === 0 && extra.length === 0 && mismatched.length === 0, missing, extra, mismatched });
}

function serializeManifest(manifest, options = {}) {
  assertPlainObject(options, 'options');
  const limits = normalizeLimits(options.limits ?? {});
  const canonical = validateManifest(manifest, limits);
  const serialized = JSON.stringify(canonical);
  if (byteLength(serialized) > limits.maxManifestBytes) fail('LIMIT_EXCEEDED', 'Manifest exceeds size limit');
  return serialized;
}

function parseManifest(serialized, options = {}) {
  assertPlainObject(options, 'options');
  const limits = normalizeLimits(options.limits ?? {});
  if (typeof serialized !== 'string') fail('INVALID_MANIFEST', 'Serialized manifest must be a string');
  if (byteLength(serialized) > limits.maxManifestBytes) fail('LIMIT_EXCEEDED', 'Manifest exceeds size limit');
  let parsed;
  try { parsed = JSON.parse(serialized); } catch { fail('INVALID_MANIFEST', 'Malformed JSON manifest'); }
  return deepFreeze(validateManifest(parsed, limits));
}

export { DEFAULT_LIMITS, ManifestIntegrityError, createManifest, verifyManifest, serializeManifest, parseManifest };
