import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAGIC = 'SAB1';
const DEFAULT_LIMITS = Object.freeze({ maxEntries: 4096, maxPathBytes: 1024, maxEntryBytes: 16 * 1024 * 1024, maxMetadataBytes: 16 * 1024, maxBundleBytes: 64 * 1024 * 1024 });
class ArtifactBundleError extends Error { constructor(code, message) { super(message); this.name = 'ArtifactBundleError'; this.code = code; Object.freeze(this); } }
const fail = (code, message) => { throw new ArtifactBundleError(code, message); };
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const freezeRecord = (value) => Object.freeze(value);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const byteLength = (value) => Buffer.byteLength(value, 'utf8');

function rejectAccessors(value, label) {
  if (!isRecord(value)) fail('INVALID_DEFINITION', `${label} must be an object`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_DEFINITION', `${label} contains an accessor`);
  }
}
function limitsOf(input = {}) {
  rejectAccessors(input, 'limits');
  const merged = { ...DEFAULT_LIMITS, ...input };
  for (const value of Object.values(merged)) if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_LIMIT', 'Invalid limit');
  return freezeRecord(merged);
}
function normalizePath(input, limits) {
  if (typeof input !== 'string' || !input) fail('INVALID_PATH', 'Path must be non-empty');
  if (input.includes('\\') || input.startsWith('/') || /^[A-Za-z]:/.test(input)) fail('INVALID_PATH', 'Path must be relative POSIX-style');
  const segments = input.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) fail('INVALID_PATH', 'Path contains unsafe segments');
  if (byteLength(input) > limits.maxPathBytes) fail('LIMIT_EXCEEDED', 'Path exceeds limit');
  return input;
}
function normalizeMetadata(metadata, limits) {
  rejectAccessors(metadata, 'metadata');
  const text = JSON.stringify(metadata);
  if (byteLength(text) > limits.maxMetadataBytes) fail('LIMIT_EXCEEDED', 'Metadata exceeds limit');
  return JSON.parse(text);
}
function entryFromBytes(input, limits) {
  rejectAccessors(input, 'entry');
  const pathValue = normalizePath(input.path, limits);
  const bytes = input.bytes instanceof Uint8Array ? Buffer.from(input.bytes) : null;
  if (!bytes) fail('UNSUPPORTED_VALUE', 'Entry bytes must be Uint8Array');
  if (bytes.length > limits.maxEntryBytes) fail('LIMIT_EXCEEDED', 'Entry exceeds limit');
  return { path: pathValue, bytes, size: bytes.length, sha256: sha256(bytes) };
}
function canonicalManifest(entries, metadata, limits) {
  if (!Array.isArray(entries) || entries.length > limits.maxEntries) fail('LIMIT_EXCEEDED', 'Entry count exceeds limit');
  const seen = new Set();
  const normalized = entries.map((entry) => {
    const value = entryFromBytes(entry, limits);
    if (seen.has(value.path)) fail('DUPLICATE_PATH', `Duplicate path: ${value.path}`);
    seen.add(value.path);
    return value;
  }).sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: false }));
  const manifest = { format: MAGIC, version: 1, metadata: normalizeMetadata(metadata, limits), entries: normalized.map((entry) => ({ path: entry.path, size: entry.size, sha256: entry.sha256, data: entry.bytes.toString('base64') })) };
  const serialized = JSON.stringify(manifest);
  if (byteLength(serialized) > limits.maxBundleBytes) fail('LIMIT_EXCEEDED', 'Bundle exceeds limit');
  return { manifest, bytes: Buffer.from(`${MAGIC}\n${serialized}\n`, 'utf8') };
}
function validateManifest(manifest, limits) {
  rejectAccessors(manifest, 'manifest');
  if (manifest.format !== MAGIC || manifest.version !== 1 || !Array.isArray(manifest.entries)) fail('INVALID_BUNDLE', 'Unsupported bundle format');
  if (manifest.entries.length > limits.maxEntries) fail('LIMIT_EXCEEDED', 'Entry count exceeds limit');
  const seen = new Set();
  const entries = manifest.entries.map((entry) => {
    rejectAccessors(entry, 'manifest entry');
    const pathValue = normalizePath(entry.path, limits);
    if (seen.has(pathValue)) fail('DUPLICATE_PATH', `Duplicate path: ${pathValue}`);
    seen.add(pathValue);
    if (typeof entry.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry.data)) fail('INVALID_BUNDLE', `Invalid data encoding for ${pathValue}`);
    const bytes = Buffer.from(entry.data, 'base64');
    if (bytes.length > limits.maxEntryBytes) fail('LIMIT_EXCEEDED', 'Entry exceeds limit');
    if (!Number.isSafeInteger(entry.size) || entry.size !== bytes.length) fail('INTEGRITY_MISMATCH', `Invalid size for ${pathValue}`);
    if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256) || entry.sha256 !== sha256(bytes)) fail('INTEGRITY_MISMATCH', `Invalid digest for ${pathValue}`);
    return Object.freeze({ path: pathValue, size: entry.size, sha256: entry.sha256, data: entry.data });
  }).sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: false }));
  return Object.freeze({ format: MAGIC, version: 1, metadata: normalizeMetadata(manifest.metadata ?? {}, limits), entries: Object.freeze(entries) });
}
function createBundle(entries, options = {}) {
  rejectAccessors(options, 'options');
  const limits = limitsOf(options.limits ?? {});
  return freezeRecord(canonicalManifest(entries, options.metadata ?? {}, limits));
}
function parseBundle(input, options = {}) {
  rejectAccessors(options, 'options');
  const limits = limitsOf(options.limits ?? {});
  const raw = input instanceof Uint8Array ? Buffer.from(input) : typeof input === 'string' ? Buffer.from(input, 'utf8') : null;
  if (!raw) fail('UNSUPPORTED_VALUE', 'Bundle must be bytes or string');
  if (raw.length > limits.maxBundleBytes) fail('LIMIT_EXCEEDED', 'Bundle exceeds limit');
  const text = raw.toString('utf8');
  if (!text.startsWith(`${MAGIC}\n`)) fail('INVALID_BUNDLE', 'Invalid bundle header');
  const body = text.slice(MAGIC.length + 1).trimEnd();
  let manifest;
  try { manifest = JSON.parse(body); } catch { fail('INVALID_BUNDLE', 'Malformed bundle payload'); }
  return validateManifest(manifest, limits);
}
function verifyBundle(bundle, options = {}) {
  const manifest = parseBundle(bundle, options);
  const mismatches = [];
  for (const entry of manifest.entries) {
    const bytes = Buffer.from(entry.data, 'base64');
    if (bytes.length !== entry.size || sha256(bytes) !== entry.sha256) mismatches.push(Object.freeze({ path: entry.path, reason: 'INTEGRITY_MISMATCH' }));
  }
  return Object.freeze({ ok: mismatches.length === 0, mismatches: Object.freeze(mismatches), entries: manifest.entries.length });
}
async function extractBundle(bundle, targetRoot, options = {}) {
  if (typeof targetRoot !== 'string' || !targetRoot) fail('INVALID_PATH', 'Target root is required');
  const manifest = parseBundle(bundle, options);
  const verification = verifyBundle(bundle, options);
  if (!verification.ok) fail('CORRUPT_BUNDLE', 'Bundle verification failed');
  const root = path.resolve(targetRoot);
  await fs.mkdir(root, { recursive: true });
  for (const entry of manifest.entries) {
    const destination = path.resolve(root, ...entry.path.split('/'));
    if (!(destination === root || destination.startsWith(`${root}${path.sep}`))) fail('INVALID_PATH', 'Extraction escapes target root');
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const bytes = Buffer.from(entry.data, 'base64');
    try { await fs.writeFile(destination, bytes, { flag: 'wx' }); }
    catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const existing = await fs.readFile(destination);
      if (sha256(existing) !== entry.sha256) fail('COLLISION', `Existing file differs: ${entry.path}`);
    }
  }
  return Object.freeze({ root, entries: manifest.entries.length });
}
export { MAGIC, DEFAULT_LIMITS, ArtifactBundleError, createBundle, parseBundle, verifyBundle, extractBundle };
