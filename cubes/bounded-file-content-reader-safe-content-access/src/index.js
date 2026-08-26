import { open as nativeOpen, lstat as nativeLstat, stat as nativeStat, realpath as nativeRealpath } from 'node:fs/promises';
import { resolveContained } from '../../safe-path-resolver-containment-boundary/src/index.js';

const FORMAT = 'FCR1';
const HARD_MAX_PATH = 32 * 1024;
const HARD_MAX_BYTES = 64 * 1024 * 1024;
const HARD_MAX_CHUNK = 4 * 1024 * 1024;
const HARD_MAX_WORK = 10_000_000;
const HARD_MAX_DIAGNOSTICS = 2048;
const DEFAULTS = Object.freeze({ mode: 'binary', offset: 0, length: null, chunkSize: 64 * 1024, maxBytes: 8 * 1024 * 1024, maxChunks: 100_000, maxWorkUnits: 1_000_000, maxPathLength: HARD_MAX_PATH, maxDiagnosticBytes: HARD_MAX_DIAGNOSTICS, deadlineMs: null, root: null, symlinkPolicy: 'reject', bom: 'strip', newline: 'preserve', consistency: 'strict', partial: 'throw' });

export class FileContentReaderError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'FileContentReaderError'; this.code = code; this.details = Object.freeze({ ...details }); Object.freeze(this); }
}
const fail = (code, message, details = {}) => { throw new FileContentReaderError(code, message, details); };
const freeze = (value) => Object.freeze(value);

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
  assertContainer(input, 'options'); validatePlain(input, 'options');
  const o = Object.freeze({ ...DEFAULTS, ...input });
  if (!['binary', 'text'].includes(o.mode)) fail('INVALID_OPTIONS', 'mode is invalid');
  if (!Number.isSafeInteger(o.offset) || o.offset < 0) fail('INVALID_OPTIONS', 'offset is invalid');
  if (o.length !== null && (!Number.isSafeInteger(o.length) || o.length < 0)) fail('INVALID_OPTIONS', 'length is invalid');
  if (o.length !== null && o.offset > Number.MAX_SAFE_INTEGER - o.length) fail('OFFSET_LIMIT_EXCEEDED', 'offset + length exceeds safe integer range');
  if (!Number.isSafeInteger(o.chunkSize) || o.chunkSize < 1 || o.chunkSize > HARD_MAX_CHUNK) fail('INVALID_OPTIONS', 'chunkSize is invalid');
  if (!Number.isSafeInteger(o.maxBytes) || o.maxBytes < 0 || o.maxBytes > HARD_MAX_BYTES) fail('INVALID_OPTIONS', 'maxBytes is invalid');
  if (!Number.isSafeInteger(o.maxChunks) || o.maxChunks < 1) fail('INVALID_OPTIONS', 'maxChunks is invalid');
  if (!Number.isSafeInteger(o.maxWorkUnits) || o.maxWorkUnits < 1 || o.maxWorkUnits > HARD_MAX_WORK) fail('INVALID_OPTIONS', 'maxWorkUnits is invalid');
  if (!Number.isSafeInteger(o.maxPathLength) || o.maxPathLength < 1 || o.maxPathLength > HARD_MAX_PATH) fail('INVALID_OPTIONS', 'maxPathLength is invalid');
  if (!Number.isSafeInteger(o.maxDiagnosticBytes) || o.maxDiagnosticBytes < 1 || o.maxDiagnosticBytes > HARD_MAX_DIAGNOSTICS) fail('INVALID_OPTIONS', 'maxDiagnosticBytes is invalid');
  if (o.deadlineMs !== null && (!Number.isSafeInteger(o.deadlineMs) || o.deadlineMs < 1)) fail('INVALID_OPTIONS', 'deadlineMs is invalid');
  if (o.root !== null && (typeof o.root !== 'string' || !o.root || o.root.includes('\0') || o.root.length > o.maxPathLength)) fail('INVALID_OPTIONS', 'root is invalid');
  if (!['reject', 'report', 'follow-contained'].includes(o.symlinkPolicy)) fail('INVALID_OPTIONS', 'symlinkPolicy is invalid');
  if (!['strip', 'preserve', 'reject'].includes(o.bom)) fail('INVALID_OPTIONS', 'bom is invalid');
  if (!['preserve', 'lf'].includes(o.newline)) fail('INVALID_OPTIONS', 'newline is invalid');
  if (!['strict', 'best-effort'].includes(o.consistency)) fail('INVALID_OPTIONS', 'consistency is invalid');
  if (!['throw', 'return'].includes(o.partial)) fail('INVALID_OPTIONS', 'partial is invalid');
  return o;
}
function assertCapabilities(c) {
  assertContainer(c, 'capabilities');
  for (const key of Object.getOwnPropertyNames(c)) {
    const descriptor = Object.getOwnPropertyDescriptor(c, key);
    if (typeof descriptor.value !== 'function') fail('CAPABILITY_FAILURE', `${key} capability must be a function`);
  }
  for (const key of ['open', 'read', 'close', 'lstat', 'now']) if (typeof c[key] !== 'function') fail('CAPABILITY_FAILURE', `${key} capability is required`);
}
const defaultCapabilities = Object.freeze({
  open: async (path) => nativeOpen(path, 'r'),
  read: async (handle, buffer, offset, length, position) => handle.read(buffer, offset, length, position),
  close: async (handle) => handle.close(),
  lstat: nativeLstat, stat: nativeStat, realpath: nativeRealpath,
  contain: async (target, root) => { try { resolveContained(root, target, { separatorNormalization: true, normalizeDotSegments: true }); return true; } catch { return false; } },
  now: () => Date.now(),
});
function normalizePath(path, o) {
  if (typeof path !== 'string' || !path) fail('INVALID_PATH', 'path must be a non-empty string');
  if (path.includes('\0')) fail('INVALID_PATH', 'path contains NUL');
  if (path.length > o.maxPathLength) fail('PATH_LIMIT_EXCEEDED', 'path exceeds maximum length');
  return path;
}
function isAbsolutePath(path) { return path.startsWith('/') || path.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(path); }
async function resolveInputPath(path, o) {
  if (o.root !== null) { try { return resolveContained(o.root, path, { separatorNormalization: true, normalizeDotSegments: true }); } catch { fail('ROOT_ESCAPE', 'path escapes declared root'); } }
  if (!isAbsolutePath(path)) fail('INVALID_PATH', 'relative path requires an explicit root');
  return path;
}
function nativeError(error) {
  if (error instanceof FileContentReaderError) return error;
  if (error?.code === 'ENOENT') return new FileContentReaderError('NOT_FOUND', 'file not found');
  if (error?.code === 'EACCES' || error?.code === 'EPERM') return new FileContentReaderError('PERMISSION_DENIED', 'permission denied');
  return new FileContentReaderError('READ_FAILURE', 'filesystem read failed');
}
function boundedMessage(error, max) { return typeof error?.message === 'string' ? error.message.slice(0, max) : ''; }
function snapshot(stat) {
  if (!stat || typeof stat !== 'object') return null;
  return freeze({ size: Number.isSafeInteger(stat.size) && stat.size >= 0 ? stat.size : null, mtimeMs: Number.isFinite(stat.mtimeMs) ? stat.mtimeMs : null, ino: Number.isSafeInteger(stat.ino) && stat.ino >= 0 ? stat.ino : null, dev: Number.isSafeInteger(stat.dev) && stat.dev >= 0 ? stat.dev : null });
}
function compareSnapshots(a, b) { if (!a || !b) return null; return a.size === b.size && a.mtimeMs === b.mtimeMs && a.ino === b.ino && a.dev === b.dev; }
function decodeText(bytes, o) {
  let input = bytes;
  const bom = input.length >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf;
  if (bom && o.bom === 'reject') fail('DECODE_ERROR', 'UTF-8 BOM rejected');
  if (bom && o.bom === 'strip') input = input.subarray(3);
  let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(input); } catch { fail('DECODE_ERROR', 'invalid UTF-8 sequence'); }
  if (bom && o.bom === 'preserve') text = `\uFEFF${text}`;
  if (o.newline === 'lf') text = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  return text;
}
function check(signal, start, o, now) { if (signal?.aborted) fail('ABORTED', 'read aborted'); if (o.deadlineMs !== null && now() - start >= o.deadlineMs) fail('DEADLINE_EXCEEDED', 'deadline exceeded'); }
function budget(o, start, now, signal) { let units = 0; return { spend(count = 1) { units += count; if (units > o.maxWorkUnits) fail('WORK_BUDGET_EXCEEDED', 'work budget exceeded'); check(signal, start, o, now); } }; }
async function targetFor(path, o, c, work) {
  const resolved = await resolveInputPath(path, o); work.spend();
  let lstat; try { lstat = await c.lstat(resolved); } catch (error) { throw nativeError(error); }
  if (!lstat || typeof lstat.isSymbolicLink !== 'function') fail('CAPABILITY_FAILURE', 'malformed lstat result');
  if (!lstat.isSymbolicLink()) return freeze({ path: resolved, kind: 'file' });
  if (o.symlinkPolicy === 'reject') fail('SYMLINK_REJECTED', 'symlink reading is disabled');
  if (o.symlinkPolicy === 'report') return freeze({ path: resolved, kind: 'symlink' });
  if (!o.root || typeof c.realpath !== 'function' || typeof c.contain !== 'function') fail('CAPABILITY_FAILURE', 'follow-contained requires root, realpath, and containment capabilities');
  work.spend(); const real = await c.realpath(resolved); work.spend();
  let contained = false; try { contained = await c.contain(real, o.root); } catch { contained = false; }
  if (!contained) fail('ROOT_ESCAPE', 'symlink target escapes declared root');
  return freeze({ path: real, kind: 'file' });
}
async function safeStat(c, path, work) { if (typeof c.stat !== 'function') return null; work.spend(); try { return snapshot(await c.stat(path)); } catch { return null; } }
async function closeOwned(handle, c, o) {
  if (!handle) return null;
  try { await c.close(handle); return null; } catch (error) { return new FileContentReaderError('CLOSE_FAILURE', 'file handle cleanup failed', { secondary: boundedMessage(error, o.maxDiagnosticBytes) }); }
}
function withCleanup(primary, cleanup) {
  if (!cleanup) return primary;
  if (!primary) return cleanup;
  return new FileContentReaderError(primary.code, primary.message, { ...primary.details, cleanup: { code: cleanup.code, message: cleanup.message } });
}

async function collected(path, o, c, signal, start) {
  const work = budget(o, start, c.now, signal); check(signal, start, o, c.now); const target = await targetFor(path, o, c, work);
  if (target.kind === 'symlink') return freeze({ format: FORMAT, kind: 'symlink', path: target.path, offset: o.offset, requestedBytes: o.length ?? 0, actualBytes: 0, eof: false, consistency: 'best-effort' });
  if (o.length === 0) return freeze({ format: FORMAT, kind: 'file', path: target.path, offset: o.offset, requestedBytes: 0, actualBytes: 0, eof: false, consistency: 'strict', ...(o.mode === 'text' ? { text: '' } : { data: new Uint8Array(0) }) });
  const before = await safeStat(c, target.path, work);
  let handle = null; let primary = null; let result = null; let bytes = null;
  try {
    work.spend(); handle = await c.open(target.path, 'r'); if (!handle || typeof handle !== 'object') fail('CAPABILITY_FAILURE', 'open returned invalid handle');
    const requestedBytes = Math.min(o.length ?? o.maxBytes, o.maxBytes); const chunks = []; let actual = 0; let position = o.offset; let count = 0;
    while (actual < requestedBytes) {
      work.spend(); const size = Math.min(o.chunkSize, requestedBytes - actual); const buffer = new Uint8Array(size); let readResult;
      try { readResult = await c.read(handle, buffer, 0, size, position); } catch (error) { throw nativeError(error); }
      work.spend(); const bytesRead = Number(readResult?.bytesRead);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > size) fail('CAPABILITY_FAILURE', 'read returned invalid bytesRead');
      if (bytesRead === 0) break;
      if (count >= o.maxChunks) fail('LIMIT_EXCEEDED', 'maximum chunk count exceeded');
      chunks.push(buffer.subarray(0, bytesRead)); actual += bytesRead; position += bytesRead; count += 1;
      if (bytesRead < size) break;
    }
    work.spend(); bytes = new Uint8Array(actual); let cursor = 0; for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.length; }
    if (o.mode === 'text') work.spend();
    const after = await safeStat(c, target.path, work); const comparison = compareSnapshots(before, after); const consistency = comparison === true ? 'strict' : 'best-effort';
    if (o.consistency === 'strict' && comparison === false) fail('CHANGED_DURING_READ', 'file changed during read');
    const base = { format: FORMAT, kind: 'file', path: target.path, offset: o.offset, requestedBytes, actualBytes: actual, eof: actual < requestedBytes, consistency };
    result = freeze(o.mode === 'text' ? { ...base, text: decodeText(bytes, o) } : { ...base, data: bytes });
  } catch (error) { primary = error instanceof FileContentReaderError ? error : nativeError(error); }
  const cleanup = await closeOwned(handle, c, o); const finalError = withCleanup(primary, cleanup);
  if (finalError) {
    if (o.partial === 'return') return freeze({ format: FORMAT, ok: false, error: freeze({ code: finalError.code, message: finalError.message.slice(0, o.maxDiagnosticBytes) }) });
    throw finalError;
  }
  return result;
}

function normalizeStreamText(part, state, final = false) {
  let text = `${state.pendingCR ? '\r' : ''}${part}`; state.pendingCR = false;
  if (!final && text.endsWith('\r')) { text = text.slice(0, -1); state.pendingCR = true; }
  if (state.newline === 'lf') return text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  return text;
}

async function* stream(path, o, c, signal, start) {
  const work = budget(o, start, c.now, signal); check(signal, start, o, c.now); const target = await targetFor(path, o, c, work);
  if (target.kind === 'symlink') { work.spend(); yield freeze({ format: FORMAT, kind: 'symlink', path: target.path, offset: o.offset, requestedBytes: o.length ?? 0, actualBytes: 0, eof: false, consistency: 'best-effort' }); return; }
  const before = await safeStat(c, target.path, work); let handle = null; let primary = null;
  const decoder = o.mode === 'text' ? new TextDecoder('utf-8', { fatal: true }) : null;
  const textState = { newline: o.newline, pendingCR: false }; let firstPrefix = new Uint8Array(0); let first = true;
  try {
    work.spend(); handle = await c.open(target.path, 'r'); if (!handle || typeof handle !== 'object') fail('CAPABILITY_FAILURE', 'open returned invalid handle');
    const requestedBytes = Math.min(o.length ?? o.maxBytes, o.maxBytes); let actual = 0; let position = o.offset; let index = 0;
    while (actual < requestedBytes) {
      work.spend(); const size = Math.min(o.chunkSize, requestedBytes - actual); const buffer = new Uint8Array(size); let readResult;
      try { readResult = await c.read(handle, buffer, 0, size, position); } catch (error) { throw nativeError(error); }
      work.spend(); const bytesRead = Number(readResult?.bytesRead);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > size) fail('CAPABILITY_FAILURE', 'read returned invalid bytesRead');
      if (bytesRead === 0) break;
      if (index >= o.maxChunks) fail('LIMIT_EXCEEDED', 'maximum chunk count exceeded');
      const raw = buffer.subarray(0, bytesRead); work.spend(); let payload;
      if (decoder) {
        let input = raw;
        if (first) {
          const combined = new Uint8Array(firstPrefix.length + raw.length); combined.set(firstPrefix); combined.set(raw, firstPrefix.length);
          if (combined.length < 3) { firstPrefix = combined; actual += bytesRead; position += bytesRead; first = true; continue; }
          const hasBom = combined[0] === 0xef && combined[1] === 0xbb && combined[2] === 0xbf;
          if (hasBom && o.bom === 'reject') fail('DECODE_ERROR', 'UTF-8 BOM rejected');
          input = hasBom && o.bom === 'strip' ? combined.subarray(3) : combined;
          firstPrefix = new Uint8Array(0); first = false;
          let decoded = decoder.decode(input, { stream: true });
          if (hasBom && o.bom === 'preserve') decoded = `\uFEFF${decoded}`;
          payload = normalizeStreamText(decoded, textState);
        } else {
          payload = normalizeStreamText(decoder.decode(raw, { stream: true }), textState);
        }
      } else payload = new Uint8Array(raw);
      work.spend(); yield freeze({ format: FORMAT, kind: 'file', path: target.path, offset: position, actualBytes: bytesRead, chunkIndex: index, eof: bytesRead < size, consistency: 'best-effort', data: payload });
      actual += bytesRead; position += bytesRead; index += 1; if (bytesRead < size) break;
    }
    if (decoder) {
      work.spend(); let tailInput = firstPrefix; let tail = '';
      if (first && tailInput.length > 0) { const hasBom = tailInput.length === 3 && tailInput[0] === 0xef && tailInput[1] === 0xbb && tailInput[2] === 0xbf; if (hasBom && o.bom === 'reject') fail('DECODE_ERROR', 'UTF-8 BOM rejected'); if (hasBom && o.bom !== 'preserve') tailInput = new Uint8Array(0); tail = hasBom && o.bom === 'preserve' ? '\uFEFF' : decoder.decode(tailInput, { stream: true }); }
      tail += decoder.decode(); tail = normalizeStreamText(tail, textState, true); if (tail.length > 0) { work.spend(); yield freeze({ format: FORMAT, kind: 'file', path: target.path, offset: position, actualBytes: 0, chunkIndex: index, eof: true, consistency: 'best-effort', data: tail }); }
    }
    const after = await safeStat(c, target.path, work); const comparison = compareSnapshots(before, after); if (o.consistency === 'strict' && comparison === false) fail('CHANGED_DURING_READ', 'file changed during read');
  } catch (error) { primary = error instanceof FileContentReaderError ? error : nativeError(error); }
  const cleanup = await closeOwned(handle, c, o); const finalError = withCleanup(primary, cleanup); if (finalError) throw finalError;
}

export async function readFileContent(path, options = {}, capabilities = defaultCapabilities) {
  assertContainer(options, 'options'); assertCapabilities(capabilities); const signal = options.signal;
  if (signal !== undefined && (!signal || typeof signal !== 'object' || typeof signal.aborted !== 'boolean')) fail('INVALID_OPTIONS', 'signal is invalid');
  const data = {}; for (const key of Object.getOwnPropertyNames(options)) if (key !== 'signal') data[key] = options[key];
  const normalized = normalizeOptions(data); const normalizedPath = normalizePath(path, normalized); return collected(normalizedPath, normalized, capabilities, signal, capabilities.now());
}
export function readFileStream(path, options = {}, capabilities = defaultCapabilities) {
  assertContainer(options, 'options'); assertCapabilities(capabilities); const signal = options.signal;
  if (signal !== undefined && (!signal || typeof signal !== 'object' || typeof signal.aborted !== 'boolean')) fail('INVALID_OPTIONS', 'signal is invalid');
  const data = {}; for (const key of Object.getOwnPropertyNames(options)) if (key !== 'signal') data[key] = options[key];
  const normalized = normalizeOptions(data); const normalizedPath = normalizePath(path, normalized); return stream(normalizedPath, normalized, capabilities, signal, capabilities.now());
}
export const readFileChunks = readFileStream;
export { defaultCapabilities };
export const BOUNDED_FILE_CONTENT_READER_FORMAT = FORMAT;
