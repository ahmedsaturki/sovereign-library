import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const FORMAT = 'DSM1';
const MAX_DEPTH = 64;
const MAX_ENTRIES = 100_000;
const MAX_PATH = 4096;
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;
const MAX_WARNINGS = 1024;
const MAX_WARNING = 512;
const MAX_FILE_DIGEST_BYTES = 64 * 1024 * 1024;
const DEFAULT_OPTIONS = Object.freeze({ symlinkPolicy: 'record-only', mutationPolicy: 'record-warning', digest: null });

export class DirectorySnapshotError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'DirectorySnapshotError';
    this.code = code;
    this.details = details;
    Object.freeze(this);
  }
}

function fail(code, message, details = null) { throw new DirectorySnapshotError(code, message, details); }
function capability(value, label) { if (typeof value !== 'function') fail('INVALID_CAPABILITY', `${label} must be a function`); return value; }
function stableCompare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function normalizeFsComparisonPath(value) {
  const text = String(value);
  return text.startsWith('\\\\?\\') ? text.slice(4) : text;
}

function validatePlainInput(value, label, seen = new Set(), depth = 0) {
  if (depth > 10) fail('LIMIT_EXCEEDED', `${label} exceeds maximum nesting depth`);
  if (value === null) return;
  const type = typeof value;
  if (['undefined', 'function', 'symbol', 'bigint'].includes(type)) fail('UNSUPPORTED_INPUT', `${label} contains unsupported data`);
  if (type === 'number' && !Number.isFinite(value)) fail('UNSUPPORTED_INPUT', `${label} contains a non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null && !Array.isArray(value)) fail('UNSUPPORTED_INPUT', `${label} must be plain data`);
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail('UNSUPPORTED_INPUT', `${label} contains symbol keys`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    validatePlainInput(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function validateTopLevelOptions(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_OPTIONS', 'options must be a plain object');
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) fail('INVALID_OPTIONS', 'options must be a plain object');
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string') fail('UNSUPPORTED_INPUT', 'options contains symbol keys');
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `options.${key} is accessor-backed`);
  }
}

function canonicalize(value) {
  validatePlainInput(value, 'value');
  return JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort(stableCompare).map((key) => [key, item[key]]))
    : item);
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function normalizeOptions(raw) {
  const input = raw ?? {};
  validateTopLevelOptions(input);
  const options = { ...DEFAULT_OPTIONS, ...input };
  if (!['record-only', 'reject', 'follow-contained'].includes(options.symlinkPolicy)) fail('INVALID_OPTIONS', 'unsupported symlinkPolicy');
  if (!['fail-fast', 'record-warning', 'skip-vanished'].includes(options.mutationPolicy)) fail('INVALID_OPTIONS', 'unsupported mutationPolicy');
  if (options.maxDepth !== undefined && (!Number.isInteger(options.maxDepth) || options.maxDepth < 0 || options.maxDepth > MAX_DEPTH)) fail('INVALID_OPTIONS', `maxDepth must be 0..${MAX_DEPTH}`);
  if (options.maxEntries !== undefined && (!Number.isInteger(options.maxEntries) || options.maxEntries < 1 || options.maxEntries > MAX_ENTRIES)) fail('INVALID_OPTIONS', `maxEntries must be 1..${MAX_ENTRIES}`);
  if (options.maxManifestBytes !== undefined && (!Number.isInteger(options.maxManifestBytes) || options.maxManifestBytes < 1024 || options.maxManifestBytes > MAX_MANIFEST_BYTES)) fail('INVALID_OPTIONS', `maxManifestBytes must be 1024..${MAX_MANIFEST_BYTES}`);
  if (options.maxWarnings !== undefined && (!Number.isInteger(options.maxWarnings) || options.maxWarnings < 1 || options.maxWarnings > MAX_WARNINGS)) fail('INVALID_OPTIONS', `maxWarnings must be 1..${MAX_WARNINGS}`);
  if (options.maxFileDigestBytes !== undefined && (!Number.isInteger(options.maxFileDigestBytes) || options.maxFileDigestBytes < 1 || options.maxFileDigestBytes > MAX_FILE_DIGEST_BYTES)) fail('INVALID_OPTIONS', `maxFileDigestBytes must be 1..${MAX_FILE_DIGEST_BYTES}`);
  const clock = options.clock ?? { now: () => Date.now() };
  validateTopLevelOptions(clock);
  capability(clock.now, 'clock.now');
  const fsOps = options.fsOps ?? { lstat, readdir, readFile, realpath };
  validateTopLevelOptions(fsOps);
  for (const name of ['lstat', 'readdir', 'readFile', 'realpath']) capability(fsOps[name], `fsOps.${name}`);
  const digest = options.digest ?? null;
  if (digest !== null) {
    validateTopLevelOptions(digest);
    if (typeof digest.algorithm !== 'string' || !/^[a-z0-9-]{1,32}$/i.test(digest.algorithm)) fail('INVALID_DIGEST', 'digest.algorithm is invalid');
    capability(digest.hashBuffer, 'digest.hashBuffer');
  }
  const serialize = options.serialize ?? canonicalize;
  capability(serialize, 'serialize');
  return { ...options, maxDepth: options.maxDepth ?? MAX_DEPTH, maxEntries: options.maxEntries ?? MAX_ENTRIES, maxManifestBytes: options.maxManifestBytes ?? MAX_MANIFEST_BYTES, maxWarnings: options.maxWarnings ?? MAX_WARNINGS, maxFileDigestBytes: options.maxFileDigestBytes ?? MAX_FILE_DIGEST_BYTES, clock, fsOps, digest, serialize };
}

function canonicalRelativePath(path) {
  const normalized = path.split(sep).join('/');
  return normalized === '' ? '.' : normalized;
}

function isContained(root, candidate) {
  const rootResolved = resolve(normalizeFsComparisonPath(root));
  const targetResolved = resolve(normalizeFsComparisonPath(candidate));
  if (targetResolved === rootResolved) return true;
  const rel = relative(rootResolved, targetResolved);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
}

function addWarning(warnings, options, code, path, message) {
  if (warnings.length >= options.maxWarnings) fail('LIMIT_EXCEEDED', 'warning limit exceeded');
  warnings.push({ code, path, message: String(message).slice(0, MAX_WARNING) });
}

async function statEntry(fsOps, path, relativePath, options, warnings) {
  try { return await fsOps.lstat(path); }
  catch (error) {
    if (error?.code === 'ENOENT') {
      if (options.mutationPolicy === 'skip-vanished' || options.mutationPolicy === 'record-warning') { addWarning(warnings, options, 'VANISHED_ENTRY', relativePath, 'entry vanished during capture'); return null; }
      fail('VANISHED_ENTRY', `entry vanished during capture: ${relativePath}`);
    }
    if (error?.code === 'EACCES' || error?.code === 'EPERM') {
      if (options.mutationPolicy === 'record-warning' || options.mutationPolicy === 'skip-vanished') { addWarning(warnings, options, 'PERMISSION_DENIED', relativePath, 'entry metadata could not be read'); return null; }
      fail('PERMISSION_DENIED', `entry metadata could not be read: ${relativePath}`);
    }
    throw error;
  }
}

async function digestFile(fsOps, filePath, options, relativePath) {
  if (!options.digest) return null;
  let statBefore;
  try { statBefore = await fsOps.lstat(filePath); } catch { fail('DIGEST_FAILURE', `file disappeared before digest: ${relativePath}`); }
  if (!statBefore.isFile?.()) fail('DIGEST_FAILURE', `not a regular file: ${relativePath}`);
  if (statBefore.size > options.maxFileDigestBytes) fail('LIMIT_EXCEEDED', `file exceeds digest size limit: ${relativePath}`);
  let buffer;
  try { buffer = await options.fsOps.readFile(filePath); } catch { fail('DIGEST_FAILURE', `file could not be read: ${relativePath}`); }
  let statAfter;
  try { statAfter = await options.fsOps.lstat(filePath); } catch { fail('CONCURRENT_MUTATION', `file changed during digest: ${relativePath}`); }
  if (statAfter.size !== statBefore.size || statAfter.mtimeMs !== statBefore.mtimeMs) fail('CONCURRENT_MUTATION', `file changed during digest: ${relativePath}`);
  const value = await options.digest.hashBuffer(buffer, options.digest.algorithm);
  if (typeof value !== 'string' || !/^[0-9a-f]+$/i.test(value)) fail('DIGEST_FAILURE', `digest capability returned an invalid value: ${relativePath}`);
  return `${options.digest.algorithm}:${value.toLowerCase()}`;
}

async function walkDirectory(root, current, depth, entries, warnings, options, visitedDirectories) {
  if (entries.length > options.maxEntries) fail('LIMIT_EXCEEDED', 'entry limit exceeded');
  let names;
  try { names = await options.fsOps.readdir(current); }
  catch (error) {
    const rel = canonicalRelativePath(relative(root, current));
    if (options.mutationPolicy === 'record-warning' || options.mutationPolicy === 'skip-vanished') { addWarning(warnings, options, 'DIRECTORY_READ_FAILURE', rel, error?.message ?? 'directory could not be read'); return; }
    fail(error?.code === 'EACCES' ? 'PERMISSION_DENIED' : 'DIRECTORY_READ_FAILURE', `directory could not be read: ${rel}`);
  }
  const sorted = [...names].map((item) => String(item)).sort(stableCompare);
  for (const name of sorted) {
    if (entries.length >= options.maxEntries) fail('LIMIT_EXCEEDED', 'entry limit exceeded');
    const absolute = resolve(current, name);
    const rel = canonicalRelativePath(relative(root, absolute));
    if (rel.length > MAX_PATH) fail('LIMIT_EXCEEDED', `path exceeds maximum length: ${rel}`);
    const stat = await statEntry(options.fsOps, absolute, rel, options, warnings);
    if (!stat) continue;
    if (stat.isDirectory?.()) {
      entries.push({ path: rel, type: 'directory', size: 0, mode: stat.mode & 0o7777, mtimeMs: Number.isFinite(stat.mtimeMs) ? stat.mtimeMs : null });
      if (depth >= options.maxDepth) fail('LIMIT_EXCEEDED', `maximum depth exceeded at ${rel}`);
      const childKey = resolve(normalizeFsComparisonPath(absolute));
      if (visitedDirectories.has(childKey)) fail('CONCURRENT_MUTATION', `directory cycle detected at ${rel}`);
      visitedDirectories.add(childKey);
      await walkDirectory(root, absolute, depth + 1, entries, warnings, options, visitedDirectories);
      continue;
    }
    if (stat.isSymbolicLink?.()) {
      if (options.symlinkPolicy === 'reject') fail('SYMLINK_POLICY', `symlink encountered: ${rel}`);
      let target = null;
      if (options.symlinkPolicy === 'follow-contained') {
        try {
          target = await options.fsOps.realpath(absolute);
          if (!isContained(root, target)) fail('PATH_CONTAINMENT', `symlink escapes root: ${rel}`);
          const targetStat = await options.fsOps.lstat(target);
          if (targetStat.isDirectory?.()) {
            const targetKey = resolve(normalizeFsComparisonPath(target));
            const cycle = visitedDirectories.has(targetKey);
            entries.push({ path: rel, type: 'symlink', target: canonicalRelativePath(relative(root, normalizeFsComparisonPath(target))), followed: !cycle, cycle });
            if (cycle) continue;
            if (depth >= options.maxDepth) fail('LIMIT_EXCEEDED', `maximum depth exceeded at ${rel}`);
            visitedDirectories.add(targetKey);
            await walkDirectory(root, target, depth + 1, entries, warnings, options, visitedDirectories);
            continue;
          }
          entries.push({ path: rel, type: 'symlink', target: canonicalRelativePath(relative(root, normalizeFsComparisonPath(target))), followed: false, cycle: false });
          continue;
        } catch (error) {
          if (error instanceof DirectorySnapshotError) throw error;
          fail('PATH_CONTAINMENT', `symlink target could not be resolved: ${rel}`);
        }
      }
      entries.push({ path: rel, type: 'symlink', target, followed: false, cycle: false });
      continue;
    }
    if (stat.isFile?.()) {
      const entry = { path: rel, type: 'file', size: stat.size, mode: stat.mode & 0o7777, mtimeMs: Number.isFinite(stat.mtimeMs) ? stat.mtimeMs : null };
      entry.digest = await digestFile(options.fsOps, absolute, options, rel);
      entries.push(entry);
      continue;
    }
    fail('UNSUPPORTED_ENTRY_TYPE', `unsupported filesystem entry: ${rel}`);
  }
}

export async function snapshotDirectory(rootPath, rawOptions = {}) {
  if (typeof rootPath !== 'string' || !rootPath) fail('INVALID_ROOT', 'rootPath must be a non-empty string');
  if (rootPath.length > MAX_PATH) fail('LIMIT_EXCEEDED', 'rootPath exceeds maximum length');
  const options = normalizeOptions(rawOptions);
  const root = resolve(rootPath);
  let rootStat;
  try { rootStat = await options.fsOps.lstat(root); }
  catch (error) {
    if (error?.code === 'ENOENT') fail('INVALID_ROOT', 'root path does not exist');
    if (error?.code === 'EACCES' || error?.code === 'EPERM') fail('PERMISSION_DENIED', 'root path is inaccessible');
    throw error;
  }
  if (!rootStat.isDirectory?.()) fail('INVALID_ROOT', 'root path must be a directory');
  if (rootStat.isSymbolicLink?.()) fail('INVALID_ROOT', 'root path may not be a symlink');
  const warnings = [];
  const entries = [];
  const capturedAt = new Date(options.clock.now()).toISOString();
  const visitedDirectories = new Set([resolve(normalizeFsComparisonPath(root))]);
  await walkDirectory(root, root, 0, entries, warnings, options, visitedDirectories);
  entries.sort((a, b) => stableCompare(a.path, b.path) || stableCompare(a.type, b.type));
  const logical = { format: FORMAT, root, capturedAt, entries, warnings };
  const serialized = options.serialize(logical);
  if (typeof serialized !== 'string') fail('SERIALIZATION_FAILURE', 'serialize capability must return a string');
  if (Buffer.byteLength(serialized, 'utf8') > options.maxManifestBytes) fail('LIMIT_EXCEEDED', 'manifest exceeds maximum size');
  const snapshotId = `sha256:${createHash('sha256').update(serialized, 'utf8').digest('hex')}`;
  return freezeDeep({ format: FORMAT, root, capturedAt, snapshotId, entries, warnings, serialized });
}

export function serializeDirectorySnapshot(snapshot) {
  validatePlainInput(snapshot, 'snapshot');
  return canonicalize({ format: snapshot.format, root: snapshot.root, capturedAt: snapshot.capturedAt, snapshotId: snapshot.snapshotId, entries: snapshot.entries, warnings: snapshot.warnings });
}

export const DIRECTORY_SNAPSHOT_FORMAT = FORMAT;
export const DIRECTORY_SNAPSHOT_SYMLINK_POLICIES = Object.freeze(['record-only', 'reject', 'follow-contained']);
export const DIRECTORY_SNAPSHOT_MUTATION_POLICIES = Object.freeze(['fail-fast', 'record-warning', 'skip-vanished']);
