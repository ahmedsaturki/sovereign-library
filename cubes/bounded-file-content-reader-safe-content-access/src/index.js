import { open as nativeOpen, lstat as nativeLstat, stat as nativeStat, realpath as nativeRealpath } from 'node:fs/promises';
import { resolveContained } from '../../safe-path-resolver-containment-boundary/src/index.js';

const FORMAT = 'FCR1';
const HARD_MAX_PATH = 32 * 1024;
const HARD_MAX_BYTES = 64 * 1024 * 1024;
const HARD_MAX_CHUNK = 4 * 1024 * 1024;
const HARD_MAX_WORK = 10_000_000;
const HARD_MAX_DIAGNOSTICS = 2048;

const DEFAULTS = Object.freeze({
  mode: 'binary', offset: 0, length: null, chunkSize: 64 * 1024,
  maxBytes: 8 * 1024 * 1024, maxChunks: 100_000, maxWorkUnits: 1_000_000,
  maxPathLength: HARD_MAX_PATH, maxDiagnosticBytes: HARD_MAX_DIAGNOSTICS,
  deadlineMs: null, root: null, symlinkPolicy: 'reject', bom: 'strip',
  newline: 'preserve', consistency: 'strict', partial: 'throw',
});

export class FileContentReaderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FileContentReaderError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const fail = (code, message, details = {}) => {
  throw new FileContentReaderError(code, message, details);
};

function boundedMessage(error, maxBytes) {
  const message = typeof error?.message === 'string' ? error.message : '';
  return message.slice(0, maxBytes);
}

function assertContainer(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_OPTIONS', `${label} must be an object`);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
  }
}

function validatePlain(value, label, seen = new Set(), depth = 0) {
  if (depth > 12) fail('INVALID_OPTIONS', `${label} exceeds validation depth`);
  if (value === null) return;
  const type = typeof value;
  if (['function', 'symbol', 'bigint', 'undefined'].includes(type)) fail('INVALID_OPTIONS', `${label} contains unsupported data`);
  if (type === 'number' && !Number.isFinite(value)) fail('INVALID_OPTIONS', `${label} contains non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) fail('INVALID_OPTIONS', `${label} must be plain data`);
  seen.add(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    validatePlain(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function normalizeOptions(input = {}) {
  assertContainer(input, 'options');
  validatePlain(input, 'options');
  const options = Object.freeze({ ...DEFAULTS, ...input });
  if (!['binary', 'text'].includes(options.mode)) fail('INVALID_OPTIONS', 'mode must be binary or text');
  if (!Number.isSafeInteger(options.offset) || options.offset < 0) fail('INVALID_OPTIONS', 'offset must be a non-negative safe integer');
  if (options.length !== null && (!Number.isSafeInteger(options.length) || options.length < 0)) fail('INVALID_OPTIONS', 'length must be a non-negative safe integer or null');
  if (options.length !== null && options.offset > Number.MAX_SAFE_INTEGER - options.length) fail('OFFSET_LIMIT_EXCEEDED', 'offset + length exceeds safe integer range');
  if (!Number.isSafeInteger(options.chunkSize) || options.chunkSize < 1 || options.chunkSize > HARD_MAX_CHUNK) fail('INVALID_OPTIONS', 'chunkSize is invalid');
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 0 || options.maxBytes > HARD_MAX_BYTES) fail('INVALID_OPTIONS', 'maxBytes is invalid');
  if (!Number.isSafeInteger(options.maxChunks) || options.maxChunks < 1) fail('INVALID_OPTIONS', 'maxChunks is invalid');
  if (!Number.isSafeInteger(options.maxWorkUnits) || options.maxWorkUnits < 1 || options.maxWorkUnits > HARD_MAX_WORK) fail('INVALID_OPTIONS', 'maxWorkUnits is invalid');
  if (!Number.isSafeInteger(options.maxPathLength) || options.maxPathLength < 1 || options.maxPathLength > HARD_MAX_PATH) fail('INVALID_OPTIONS', 'maxPathLength is invalid');
  if (!Number.isSafeInteger(options.maxDiagnosticBytes) || options.maxDiagnosticBytes < 1 || options.maxDiagnosticBytes > HARD_MAX_DIAGNOSTICS) fail('INVALID_OPTIONS', 'maxDiagnosticBytes is invalid');
  if (options.deadlineMs !== null && (!Number.isSafeInteger(options.deadlineMs) || options.deadlineMs < 1)) fail('INVALID_OPTIONS', 'deadlineMs is invalid');
  if (options.root !== null && (typeof options.root !== 'string' || options.root.length === 0 || options.root.includes('\0') || options.root.length > options.maxPathLength)) fail('INVALID_OPTIONS', 'root is invalid');
  if (!['reject', 'report', 'follow-contained'].includes(options.symlinkPolicy)) fail('INVALID_OPTIONS', 'symlinkPolicy is invalid');
  if (!['strip', 'preserve', 'reject'].includes(options.bom)) fail('INVALID_OPTIONS', 'bom policy is invalid');
  if (!['preserve', 'lf'].includes(options.newline)) fail('INVALID_OPTIONS', 'newline policy is invalid');
  if (!['strict', 'best-effort'].includes(options.consistency)) fail('INVALID_OPTIONS', 'consistency policy is invalid');
  if (!['throw', 'return'].includes(options.partial)) fail('INVALID_OPTIONS', 'partial policy is invalid');
  if (options.partial === 'return' && options.mode === 'text') {
    // Still bounded, but errors return a compact snapshot instead of content.
  }
  return options;
}

function assertCapabilities(capabilities) {
  assertContainer(capabilities, 'capabilities');
  for (const key of Object.getOwnPropertyNames(capabilities)) {
    const descriptor = Object.getOwnPropertyDescriptor(capabilities, key);
    if (typeof descriptor.value !== 'function') fail('CAPABILITY_FAILURE', `${key} capability must be a function`);
  }
  for (const key of ['open', 'read', 'close', 'lstat', 'now']) {
    if (typeof capabilities[key] !== 'function') fail('CAPABILITY_FAILURE', `${key} capability is required`);
  }
}

const defaultCapabilities = Object.freeze({
  open: async (path) => nativeOpen(path, 'r'),
  read: async (handle, buffer, offset, length, position) => handle.read(buffer, offset, length, position),
  close: async (handle) => handle.close(),
  lstat: nativeLstat,
  stat: nativeStat,
  realpath: nativeRealpath,
  contain: async (target, root) => {
    try { resolveContained(root, target, { separatorNormalization: true, normalizeDotSegments: true }); return true; } catch { return false; }
  },
  now: () => Date.now(),
});

function normalizePath(path, options) {
  if (typeof path !== 'string' || path.length === 0) fail('INVALID_PATH', 'path must be a non-empty string');
  if (path.includes('\0')) fail('INVALID_PATH', 'path contains NUL');
  if (path.length > options.maxPathLength) fail('PATH_LIMIT_EXCEEDED', 'path exceeds maximum length');
  return path;
}

function isAbsolutePath(path) {
  return path.startsWith('/') || path.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(path);
}

async function resolveInputPath(path, options) {
  if (options.root !== null) {
    try {
      return resolveContained(options.root, path, { separatorNormalization: true, normalizeDotSegments: true });
    } catch {
      fail('ROOT_ESCAPE', 'path escapes declared root');
    }
  }
  if (!isAbsolutePath(path)) fail('INVALID_PATH', 'relative path requires an explicit root');
  return path;
}

function statSnapshot(stat) {
  if (!stat || typeof stat !== 'object') return null;
  const snapshot = {
    size: Number.isSafeInteger(stat.size) && stat.size >= 0 ? stat.size : null,
    mtimeMs: Number.isFinite(stat.mtimeMs) ? stat.mtimeMs : null,
    ino: Number.isSafeInteger(stat.ino) && stat.ino >= 0 ? stat.ino : null,
    dev: Number.isSafeInteger(stat.dev) && stat.dev >= 0 ? stat.dev : null,
  };
  return Object.freeze(snapshot);
}

function sameSnapshot(before, after) {
  if (!before || !after) return null;
  return before.size === after.size && before.mtimeMs === after.mtimeMs && before.ino === after.ino && before.dev === after.dev;
}

function decodeText(bytes, options) {
  let value = bytes;
  const hasBom = value.length >= 3 && value[0] === 0xef && value[1] === 0xbb && value[2] === 0xbf;
  if (hasBom && options.bom === 'reject') fail('DECODE_ERROR', 'UTF-8 BOM rejected');
  if (hasBom) value = value.subarray(3);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(value); } catch { fail('DECODE_ERROR', 'invalid UTF-8 sequence'); }
  if (hasBom && options.bom === 'preserve') text = `\uFEFF${text}`;
  if (options.newline === 'lf') text = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  return text;
}

function throwIfAborted(signal) { if (signal?.aborted) fail('ABORTED', 'read aborted'); }

function throwIfDeadline(start, options, now) {
  if (options.deadlineMs !== null && now() - start >= options.deadlineMs) fail('DEADLINE_EXCEEDED', 'deadline exceeded');
}

function createWorkBudget(options, start, now, signal) {
  let units = 0;
  return {
    spend(count = 1) {
      units += count;
      if (units > options.maxWorkUnits) fail('WORK_BUDGET_EXCEEDED', 'work budget exceeded');
      throwIfAborted(signal);
      throwIfDeadline(start, options, now);
    },
    value() { return units; },
  };
}

async function identifyTarget(path, options, capabilities, work) {
  const resolved = await resolveInputPath(path, options);
  work.spend();
  let stat;
  try { stat = await capabilities.lstat(resolved); } catch (error) { throw mapNativeError(error); }
  if (!stat || typeof stat.isSymbolicLink !== 'function') fail('CAPABILITY_FAILURE', 'malformed lstat result');
  const symlink = stat.isSymbolicLink();
  if (!symlink) return Object.freeze({ path: resolved, kind: 'file' });
  if (options.symlinkPolicy === 'reject') fail('SYMLINK_REJECTED', 'symlink reading is disabled');
  if (options.symlinkPolicy === 'report') return Object.freeze({ path: resolved, kind: 'symlink' });
  if (typeof capabilities.realpath !== 'function' || typeof capabilities.contain !== 'function' || options.root === null) fail('CAPABILITY_FAILURE', 'follow-contained requires root, realpath and containment capabilities');
  work.spend();
  const target = await capabilities.realpath(resolved);
  work.spend();
  let contained = false;
  try { contained = await capabilities.contain(target, options.root); } catch { contained = false; }
  if (!contained) fail('ROOT_ESCAPE', 'symlink target escapes declared root');
  return Object.freeze({ path: target, kind: 'file' });
}

function mapNativeError(error) {
  if (error instanceof FileContentReaderError) return error;
  if (error?.code === 'ENOENT') return new FileContentReaderError('NOT_FOUND', 'file not found');
  if (error?.code === 'EACCES' || error?.code === 'EPERM') return new FileContentReaderError('PERMISSION_DENIED', 'permission denied');
  return new FileContentReaderError('READ_FAILURE', 'filesystem read failed');
}

async function safeStat(capabilities, path, work) {
  if (typeof capabilities.stat !== 'function') return null;
  work.spend();
  try { return statSnapshot(await capabilities.stat(path)); } catch { return null; }
}

async function closeOwnedHandle(handle, capabilities, primaryError, options) {
  if (!handle) return primaryError;
  try {
    await capabilities.close(handle);
  } catch (error) {
    const cleanup = new FileContentReaderError('CLOSE_FAILURE', 'file handle cleanup failed', { secondary: boundedMessage(error, options.maxDiagnosticBytes) });
    if (primaryError) return new FileContentReaderError(primaryError.code, primaryError.message, { ...primaryError.details, cleanup: { code: cleanup.code, message: cleanup.message } });
    return cleanup;
  }
  return primaryError;
}

async function readCollected(path, options, capabilities, signal, start) {
  throwIfAborted(signal);
  const work = createWorkBudget(options, start, capabilities.now, signal);
  const target = await identifyTarget(path, options, capabilities, work);
  if (target.kind === 'symlink') return Object.freeze({ format: FORMAT, kind: 'symlink', path: target.path, offset: options.offset, requestedBytes: options.length ?? 0, actualBytes: 0, eof: false, consistency: 'best-effort' });
  if (options.length === 0) return Object.freeze({ format: FORMAT, kind: 'file', path: target.path, offset: options.offset, requestedBytes: 0, actualBytes: 0, eof: false, consistency: 'strict', ...(options.mode === 'text' ? { text: '' } : { data: new Uint8Array(0) }) });

  const before = await safeStat(capabilities, target.path, work);
  let handle = null;
  let primaryError = null;
  try {
    work.spend();
    handle = await capabilities.open(target.path, 'r');
    if (!handle || typeof handle !== 'object') fail('CAPABILITY_FAILURE', 'open returned an invalid handle');
    const requestedBytes = Math.min(options.length ?? options.maxBytes, options.maxBytes);
    const chunks = [];
    let actualBytes = 0;
    let position = options.offset;
    let chunkIndex = 0;

    while (actualBytes < requestedBytes) {
      work.spend();
      const size = Math.min(options.chunkSize, requestedBytes - actualBytes);
      const buffer = new Uint8Array(size);
      let readResult;
      try { readResult = await capabilities.read(handle, buffer, 0, size, position); } catch (error) { throw mapNativeError(error); }
      work.spend();
      const bytesRead = Number(readResult?.bytesRead);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > size) fail('CAPABILITY_FAILURE', 'read returned invalid bytesRead');
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      actualBytes += bytesRead;
      position += bytesRead;
      chunkIndex += 1;
      if (chunkIndex > options.maxChunks) fail('LIMIT_EXCEEDED', 'maximum chunk count exceeded');
      if (bytesRead < size) break;
    }

    work.spend();
    const bytes = new Uint8Array(actualBytes);
    let cursor = 0;
    for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.length; }
    if (options.mode === 'text') work.spend();
    const after = await safeStat(capabilities, target.path, work);
    let consistency = 'best-effort';
    const changed = sameSnapshot(before, after);
    if (options.consistency === 'strict' && changed === false) fail('CHANGED_DURING_READ', 'file changed during read');
    if (changed === true) consistency = 'strict';

    const base = Object.freeze({ format: FORMAT, kind: 'file', path: target.path, offset: options.offset, requestedBytes, actualBytes, eof: actualBytes < requestedBytes, consistency });
    return Object.freeze(options.mode === 'text' ? { ...base, text: decodeText(bytes, options) } : { ...base, data: bytes });
  } catch (error) {
    primaryError = error instanceof FileContentReaderError ? error : mapNativeError(error);
    if (options.partial === 'return') {
      primaryError = Object.freeze(new FileContentReaderError(primaryError.code, primaryError.message.slice(0, options.maxDiagnosticBytes), primaryError.details));
    }
    if (options.partial === 'return') {
      return Object.freeze({ format: FORMAT, ok: false, error: Object.freeze({ code: primaryError.code, message: primaryError.message }) });
    }
    throw primaryError;
  } finally {
    const cleanupError = await closeOwnedHandle(handle, capabilities, primaryError, options);
    if (cleanupError && cleanupError !== primaryError) throw cleanupError;
  }
}

async function* readStream(path, options, capabilities, signal, start) {
  throwIfAborted(signal);
  const work = createWorkBudget(options, start, capabilities.now, signal);
  const target = await identifyTarget(path, options, capabilities, work);
  if (target.kind === 'symlink') {
    work.spend();
    yield Object.freeze({ format: FORMAT, kind: 'symlink', path: target.path, offset: options.offset, requestedBytes: options.length ?? 0, actualBytes: 0, eof: false, consistency: 'best-effort' });
    return;
  }

  const before = await safeStat(capabilities, target.path, work);
  let handle = null;
  let primaryError = null;
  try {
    work.spend();
    handle = await capabilities.open(target.path, 'r');
    if (!handle || typeof handle !== 'object') fail('CAPABILITY_FAILURE', 'open returned an invalid handle');
    const requestedBytes = Math.min(options.length ?? options.maxBytes, options.maxBytes);
    const decoder = options.mode === 'text' ? new TextDecoder('utf-8', { fatal: true }) : null;
    let actualBytes = 0;
    let position = options.offset;
    let chunkIndex = 0;
    let firstChunk = true;

    while (actualBytes < requestedBytes) {
      work.spend();
      const size = Math.min(options.chunkSize, requestedBytes - actualBytes);
      const buffer = new Uint8Array(size);
      let readResult;
      try { readResult = await capabilities.read(handle, buffer, 0, size, position); } catch (error) { throw mapNativeError(error); }
      work.spend();
      const bytesRead = Number(readResult?.bytesRead);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > size) fail('CAPABILITY_FAILURE', 'read returned invalid bytesRead');
      if (bytesRead === 0) break;
      const raw = buffer.subarray(0, bytesRead);
      work.spend();
      let payload;
      if (decoder) {
        let bytesForDecode = raw;
        if (firstChunk && bytesForDecode.length >= 3 && bytesForDecode[0] === 0xef && bytesForDecode[1] === 0xbb && bytesForDecode[2] === 0xbf) {
          if (options.bom === 'reject') fail('DECODE_ERROR', 'UTF-8 BOM rejected');
          if (options.bom === 'strip') bytesForDecode = bytesForDecode.subarray(3);
        }
        payload = decoder.decode(bytesForDecode, { stream: true });
      } else {
        payload = new Uint8Array(raw);
      }
      work.spend();
      yield Object.freeze({ format: FORMAT, kind: 'file', path: target.path, offset: position, actualBytes: bytesRead, chunkIndex, eof: bytesRead < size, consistency: 'best-effort', data: payload });
      actualBytes += bytesRead;
      position += bytesRead;
      chunkIndex += 1;
      if (chunkIndex > options.maxChunks) fail('LIMIT_EXCEEDED', 'maximum chunk count exceeded');
      firstChunk = false;
      if (bytesRead < size) break;
    }

    if (decoder) {
      work.spend();
      const tail = decoder.decode();
      if (tail.length > 0) { work.spend(); yield Object.freeze({ format: FORMAT, kind: 'file', path: target.path, offset: position, actualBytes: 0, chunkIndex, eof: true, consistency: 'best-effort', data: options.newline === 'lf' ? tail.replaceAll('\r\n', '\n').replaceAll('\r', '\n') : tail }); }
    }

    const after = await safeStat(capabilities, target.path, work);
    const changed = sameSnapshot(before, after);
    if (options.consistency === 'strict' && changed === false) fail('CHANGED_DURING_READ', 'file changed during read');
  } catch (error) {
    primaryError = error instanceof FileContentReaderError ? error : mapNativeError(error);
    throw primaryError;
  } finally {
    const cleanupError = await closeOwnedHandle(handle, capabilities, primaryError, options);
    if (cleanupError && cleanupError !== primaryError) throw cleanupError;
  }
}

export async function readFileContent(path, options = {}, capabilities = defaultCapabilities) {
  assertContainer(options, 'options');
  assertCapabilities(capabilities);
  const signal = options.signal;
  if (signal !== undefined && (!signal || typeof signal !== 'object' || typeof signal.aborted !== 'boolean')) fail('INVALID_OPTIONS', 'signal is invalid');
  const data = {};
  for (const key of Object.getOwnPropertyNames(options)) if (key !== 'signal') data[key] = options[key];
  const normalized = normalizeOptions(data);
  const normalizedPath = normalizePath(path, normalized);
  const start = capabilities.now();
  return readCollected(normalizedPath, normalized, capabilities, signal, start);
}

export function readFileStream(path, options = {}, capabilities = defaultCapabilities) {
  assertContainer(options, 'options');
  assertCapabilities(capabilities);
  const signal = options.signal;
  if (signal !== undefined && (!signal || typeof signal !== 'object' || typeof signal.aborted !== 'boolean')) fail('INVALID_OPTIONS', 'signal is invalid');
  const data = {};
  for (const key of Object.getOwnPropertyNames(options)) if (key !== 'signal') data[key] = options[key];
  const normalized = normalizeOptions(data);
  const normalizedPath = normalizePath(path, normalized);
  return readStream(normalizedPath, normalized, capabilities, signal, capabilities.now());
}

export const readFileChunks = readFileStream;
export { defaultCapabilities };
export const BOUNDED_FILE_CONTENT_READER_FORMAT = FORMAT;
