import { open as nativeOpen, lstat as nativeLstat, stat as nativeStat, realpath as nativeRealpath } from 'node:fs/promises';
import { resolveContained } from '../../safe-path-resolver-containment-boundary/src/index.js';
import { dirname, resolve as resolvePath } from 'node:path';

const HARD_MAX_PATH = 32 * 1024;
const HARD_MAX_BYTES = 64 * 1024 * 1024;
const HARD_MAX_CHUNK = 4 * 1024 * 1024;
const HARD_MAX_WORK = 10_000_000;
const HARD_MAX_DIAGNOSTICS = 2048;

export class FileContentReaderError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'FileContentReaderError'; this.code = code; this.details = Object.freeze({ ...details }); }
}
function fail(code, message, details) { throw new FileContentReaderError(code, message, details); }

function assertOptionsContainer(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) fail('INVALID_OPTIONS', 'options must be an object');
  for (const key of Object.getOwnPropertyNames(options)) {
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `options.${key} is accessor-backed`);
  }
}
function validatePlain(value, label, seen = new Set(), depth = 0) {
  if (depth > 12) fail('INVALID_OPTIONS', `${label} exceeds validation depth`);
  if (value === null) return;
  const type = typeof value;
  if (type === 'function' || type === 'symbol' || type === 'bigint' || type === 'undefined') fail('INVALID_OPTIONS', `${label} contains unsupported data`);
  if (type === 'number' && !Number.isFinite(value)) fail('INVALID_OPTIONS', `${label} contains a non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('INVALID_OPTIONS', `${label} is circular`);
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) fail('INVALID_OPTIONS', `${label} must contain plain data`);
  seen.add(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    validatePlain(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

const DEFAULTS = Object.freeze({
  mode: 'binary',
  offset: 0,
  length: null,
  chunkSize: 64 * 1024,
  maxBytes: 8 * 1024 * 1024,
  maxChunks: 100_000,
  maxWorkUnits: 1_000_000,
  maxPathLength: HARD_MAX_PATH,
  maxDiagnosticBytes: HARD_MAX_DIAGNOSTICS,
  deadlineMs: null,
  root: null,
  symlinkPolicy: 'reject',
  bom: 'strip',
  newline: 'preserve',
  consistency: 'strict',
  partial: 'return',
});

function normalizeOptions(options) {
  assertOptionsContainer(options); validatePlain(options, 'options');
  const out = { ...DEFAULTS, ...options };
  if (!['binary', 'text'].includes(out.mode)) fail('INVALID_OPTIONS', 'mode must be binary or text');
  if (!Number.isSafeInteger(out.offset) || out.offset < 0) fail('INVALID_OPTIONS', 'offset must be a non-negative safe integer');
  if (out.length !== null && (!Number.isSafeInteger(out.length) || out.length < 0)) fail('INVALID_OPTIONS', 'length must be null or a non-negative safe integer');
  if (!Number.isSafeInteger(out.chunkSize) || out.chunkSize < 1 || out.chunkSize > HARD_MAX_CHUNK) fail('INVALID_OPTIONS', 'invalid chunkSize');
  if (!Number.isSafeInteger(out.maxBytes) || out.maxBytes < 0 || out.maxBytes > HARD_MAX_BYTES) fail('INVALID_OPTIONS', 'invalid maxBytes');
  if (!Number.isSafeInteger(out.maxChunks) || out.maxChunks < 1) fail('INVALID_OPTIONS', 'invalid maxChunks');
  if (!Number.isSafeInteger(out.maxWorkUnits) || out.maxWorkUnits < 1 || out.maxWorkUnits > HARD_MAX_WORK) fail('INVALID_OPTIONS', 'invalid maxWorkUnits');
  if (!Number.isSafeInteger(out.maxPathLength) || out.maxPathLength < 1 || out.maxPathLength > HARD_MAX_PATH) fail('INVALID_OPTIONS', 'invalid maxPathLength');
  if (!Number.isSafeInteger(out.maxDiagnosticBytes) || out.maxDiagnosticBytes < 1 || out.maxDiagnosticBytes > HARD_MAX_DIAGNOSTICS) fail('INVALID_OPTIONS', 'invalid maxDiagnosticBytes');
  if (out.deadlineMs !== null && (!Number.isFinite(out.deadlineMs) || out.deadlineMs <= 0)) fail('INVALID_OPTIONS', 'deadlineMs must be null or positive');
  if (out.root !== null && (typeof out.root !== 'string' || !out.root || out.root.includes('\0') || out.root.length > out.maxPathLength)) fail('INVALID_OPTIONS', 'root must be a bounded absolute path');
  if (!['reject', 'report', 'follow-contained'].includes(out.symlinkPolicy)) fail('INVALID_OPTIONS', 'invalid symlinkPolicy');
  if (!['strip', 'preserve', 'reject'].includes(out.bom)) fail('INVALID_OPTIONS', 'invalid bom policy');
  if (!['preserve', 'lf'].includes(out.newline)) fail('INVALID_OPTIONS', 'invalid newline policy');
  if (!['strict', 'best-effort'].includes(out.consistency)) fail('INVALID_OPTIONS', 'invalid consistency policy');
  if (!['return', 'throw'].includes(out.partial)) fail('INVALID_OPTIONS', 'invalid partial policy');
  if (out.offset > Number.MAX_SAFE_INTEGER - (out.length ?? 0)) fail('INVALID_OPTIONS', 'offset + length overflow');
  return Object.freeze(out);
}

function assertCapabilities(capabilities) {
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) fail('CAPABILITY_FAILURE', 'capabilities must be an object');
  for (const key of Object.getOwnPropertyNames(capabilities)) {
    const descriptor = Object.getOwnPropertyDescriptor(capabilities, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `capabilities.${key} is accessor-backed`);
    if (typeof descriptor.value !== 'function') fail('CAPABILITY_FAILURE', `${key} capability must be a function`);
  }
  for (const required of ['open', 'read', 'close', 'lstat']) if (typeof capabilities[required] !== 'function') fail('CAPABILITY_FAILURE', `${required} capability is required`);
}

const defaultCapabilities = Object.freeze({
  open: async (path) => nativeOpen(path, 'r'),
  read: async (handle, buffer, offset, length, position) => handle.read(buffer, offset, length, position),
  close: async (handle) => handle.close(),
  lstat: nativeLstat,
  stat: nativeStat,
  realpath: nativeRealpath,
  contain: async (target, root) => { try { resolveContained(root, target, { separatorNormalization: true, normalizeDotSegments: true }); return true; } catch { return false; } },
  now: () => Date.now(),
});

function boundedDiagnostic(error) { const raw = error instanceof Error ? error.message : String(error); return raw.slice(0, HARD_MAX_DIAGNOSTICS); }
function mapError(error) {
  if (error instanceof FileContentReaderError) return error;
  if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return new FileContentReaderError('NOT_FOUND', 'file was not found');
  if (error?.code === 'EACCES' || error?.code === 'EPERM') return new FileContentReaderError('PERMISSION_DENIED', 'permission denied');
  return new FileContentReaderError('READ_FAILURE', boundedDiagnostic(error));
}
function makeResult(fields) { return Object.freeze({ ...fields }); }

async function resolveTarget(path, options, caps) {
  const lstatResult = await caps.lstat(path);
  if (!lstatResult?.isSymbolicLink?.()) return { path, kind: 'regular' };
  if (options.symlinkPolicy === 'reject') fail('SYMLINK_REJECTED', 'symlink reading is disabled by policy', { path });
  if (options.symlinkPolicy === 'report') return { path, kind: 'symlink' };
  if (typeof caps.realpath !== 'function' || typeof caps.contain !== 'function') fail('CAPABILITY_FAILURE', 'follow-contained requires realpath and contain capabilities');
  const root = options.root;
  if (!root) fail('INVALID_OPTIONS', 'follow-contained requires root');
  const canonical = await caps.realpath(path);
  if (!(await caps.contain(canonical, root))) fail('ROOT_ESCAPE', 'resolved symlink target is outside root');
  return { path: canonical, kind: 'regular' };
}

async function getStat(caps, path) {
  if (typeof caps.stat !== 'function') return null;
  try { return await caps.stat(path); } catch { return null; }
}

function checkAbort(signal) { if (signal?.aborted) fail('ABORTED', 'read aborted'); }
function decodeText(bytes, options) {
  let data = bytes;
  const hasBom = data.byteLength >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF;
  if (hasBom && options.bom === 'reject') fail('DECODE_ERROR', 'UTF-8 BOM is rejected by policy');
  if (hasBom && options.bom === 'strip') data = data.subarray(3);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data); } catch { fail('DECODE_ERROR', 'invalid UTF-8 content'); }
  if (options.bom === 'preserve' && hasBom) text = `\uFEFF${text}`;
  if (options.newline === 'lf') text = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  return text;
}

async function withHandle(path, options, capabilities, fn) {
  let handle = null; let closed = false;
  try {
    handle = await capabilities.open(path);
    return await fn(handle);
  } catch (error) {
    const mapped = mapError(error);
    if (options.partial === 'return') return makeResult({ ok: false, error: makeResult({ code: mapped.code, message: mapped.message.slice(0, options.maxDiagnosticBytes) }) });
    throw mapped;
  } finally {
    if (handle && !closed) {
      closed = true;
      try { await capabilities.close(handle); } catch { /* never replace primary outcome */ }
    }
  }
}

async function readRange(path, options, capabilities) {
  checkAbort(options.signal);
  const target = await resolveTarget(path, options, capabilities);
  if (target.kind === 'symlink') return makeResult({ kind: 'symlink', path, offset: options.offset, requestedBytes: options.length ?? 0, actualBytes: 0, eof: false, consistency: 'best-effort', bytes: new Uint8Array(0) });
  const before = await getStat(capabilities, target.path);
  if (options.length === 0) return makeResult({ kind: 'file', path: target.path, offset: options.offset, requestedBytes: 0, actualBytes: 0, eof: false, consistency: 'strict', bytes: new Uint8Array(0) });
  return withHandle(target.path, options, capabilities, async (handle) => {
    const maxToRead = Math.min(options.length ?? options.maxBytes, options.maxBytes);
    const chunks = [];
    let total = 0; let chunksRead = 0; let work = 0; let position = options.offset;
    while (total < maxToRead) {
      checkAbort(options.signal); work += 1; if (work > options.maxWorkUnits) fail('WORK_BUDGET_EXCEEDED', 'work budget exceeded');
      if (options.deadlineMs !== null && capabilities.now() - (options._startTime ?? capabilities.now()) >= options.deadlineMs) fail('DEADLINE_EXCEEDED', 'deadline exceeded');
      if (chunksRead >= options.maxChunks) fail('LIMIT_EXCEEDED', 'maximum chunk count exceeded');
      const size = Math.min(options.chunkSize, maxToRead - total);
      const buffer = new Uint8Array(size);
      const result = await capabilities.read(handle, buffer, 0, size, position);
      const bytesRead = Number(result?.bytesRead);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > size) fail('CAPABILITY_FAILURE', 'read capability returned invalid bytesRead');
      chunksRead += 1;
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead)); total += bytesRead; position += bytesRead;
      if (bytesRead < size) break;
    }
    const bytes = new Uint8Array(total); let cursor = 0; for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.byteLength; }
    const after = await getStat(capabilities, target.path);
    let consistency = 'strict';
    if (options.consistency === 'strict' && before && after) {
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino || before.dev !== after.dev) fail('CHANGED_DURING_READ', 'file changed during read');
    } else if (options.consistency !== 'strict' || !before || !after) consistency = 'best-effort';
    const requestedBytes = maxToRead; const eof = total < requestedBytes;
    return makeResult({ kind: 'file', path: target.path, offset: options.offset, requestedBytes, actualBytes: total, eof, consistency, bytes });
  });
}

export async function readFileContent(path, options = {}, capabilities = defaultCapabilities) {
  const { signal, onChunk, ...data } = options ?? {};
  const opts = normalizeOptions({ ...data, signal, onChunk, _startTime: capabilities.now?.() ?? Date.now() });
  assertCapabilities(capabilities);
  if (typeof path !== 'string' || !path || path.includes('\0') || path.length > opts.maxPathLength) fail('INVALID_PATH', 'path is invalid or exceeds the configured bound');
  const result = await readRange(path, opts, capabilities);
  if (result?.kind === 'symlink') return result;
  if (result?.ok === false) return result;
  const bytes = result.bytes;
  if (opts.mode === 'text') {
    const text = decodeText(bytes, opts);
    return makeResult({ ...result, bytes: undefined, text });
  }
  return makeResult({ ...result });
}

export async function* readFileChunks(path, options = {}, capabilities = defaultCapabilities) {
  const { signal, onChunk, ...data } = options ?? {};
  const opts = normalizeOptions({ ...data, signal, onChunk, _startTime: capabilities.now?.() ?? Date.now() });
  assertCapabilities(capabilities);
  if (typeof path !== 'string' || !path || path.includes('\0') || path.length > opts.maxPathLength) fail('INVALID_PATH', 'path is invalid or exceeds the configured bound');
  checkAbort(signal);
  const target = await resolveTarget(path, opts, capabilities);
  if (target.kind === 'symlink') { yield makeResult({ kind: 'symlink', path, offset: opts.offset, requestedBytes: opts.length ?? 0, actualBytes: 0, eof: false, consistency: 'best-effort' }); return; }
  const before = await getStat(capabilities, target.path);
  let handle = null;
  try {
    handle = await capabilities.open(target.path);
    const maxToRead = Math.min(opts.length ?? opts.maxBytes, opts.maxBytes);
    let total = 0; let chunksRead = 0; let position = opts.offset; let work = 0;
    while (total < maxToRead) {
      checkAbort(signal); work += 1; if (work > opts.maxWorkUnits) fail('WORK_BUDGET_EXCEEDED', 'work budget exceeded');
      if (opts.deadlineMs !== null && capabilities.now() - opts._startTime >= opts.deadlineMs) fail('DEADLINE_EXCEEDED', 'deadline exceeded');
      if (chunksRead >= opts.maxChunks) fail('LIMIT_EXCEEDED', 'maximum chunk count exceeded');
      const size = Math.min(opts.chunkSize, maxToRead - total); const buffer = new Uint8Array(size);
      const readResult = await capabilities.read(handle, buffer, 0, size, position);
      const bytesRead = Number(readResult?.bytesRead);
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > size) fail('CAPABILITY_FAILURE', 'read capability returned invalid bytesRead');
      chunksRead += 1; if (bytesRead === 0) break;
      const raw = buffer.subarray(0, bytesRead); total += bytesRead; position += bytesRead;
      const payload = opts.mode === 'text' ? decodeText(raw, { ...opts, bom: total === bytesRead ? opts.bom : 'preserve' }) : new Uint8Array(raw);
      yield makeResult({ path: target.path, offset: position - bytesRead, actualBytes: bytesRead, chunkIndex: chunksRead - 1, eof: bytesRead < size, data: payload });
      if (bytesRead < size) break;
    }
    const after = await getStat(capabilities, target.path);
    if (opts.consistency === 'strict' && before && after && (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino || before.dev !== after.dev)) fail('CHANGED_DURING_READ', 'file changed during read');
  } finally {
    if (handle) { try { await capabilities.close(handle); } catch { /* primary error wins */ } }
  }
}

export { defaultCapabilities };
