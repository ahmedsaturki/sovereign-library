import { watch as nativeWatch, existsSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const MAX_ROOTS = 16;
const MAX_PATH = 4096;
const MAX_QUEUE = 1024;
const MAX_EVENT = 8192;
const MAX_DEBOUNCE_MS = 60_000;
const FORMAT = 'FWC1';
const STATES = new Set(['created', 'starting', 'running', 'closing', 'closed']);
const TYPES = new Set(['created', 'changed', 'removed', 'renamed']);

export class FilesystemWatcherError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FilesystemWatcherError';
    this.code = code;
    Object.freeze(this);
  }
}

function fail(code, message) { throw new FilesystemWatcherError(code, message); }

function safeData(value, label, seen = new Set(), depth = 0) {
  if (depth > 12) fail('DEPTH_LIMIT', `${label} exceeds depth limit`);
  if (value === null) return;
  const type = typeof value;
  if (type === 'function' || type === 'symbol' || type === 'bigint' || type === 'undefined') fail('UNSUPPORTED_VALUE', `${label} contains unsupported value`);
  if (type === 'number' && !Number.isFinite(value)) fail('UNSUPPORTED_VALUE', `${label} contains non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null && !Array.isArray(value)) fail('UNSUPPORTED_VALUE', `${label} must be plain data`);
  seen.add(value);
  for (const key of Object.keys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !('value' in d)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    safeData(d.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function validateOptionsShape(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) fail('INVALID_OPTIONS', 'options must be a plain object');
  const proto = Object.getPrototypeOf(options);
  if (proto !== Object.prototype && proto !== null) fail('INVALID_OPTIONS', 'options must be a plain object');
  const seen = new Set([options]);
  for (const key of Object.keys(options)) {
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `options.${key} is accessor-backed`);
    if (key !== 'source') safeData(descriptor.value, `options.${key}`, seen, 1);
  }
}

function text(value, label, max = MAX_PATH) {
  if (typeof value !== 'string' || value.length === 0) fail('INVALID_INPUT', `${label} must be a non-empty string`);
  if (value.length > max) fail('LIMIT_EXCEEDED', `${label} exceeds ${max} characters`);
  return value;
}

function immutable(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) immutable(child);
  return Object.freeze(value);
}

function normalizeRoot(input, index) {
  const root = text(input, `roots[${index}]`);
  const absolute = resolve(root);
  return { rootId: `root-${index + 1}`, path: absolute, publicRoot: absolute.split(sep).join('/') };
}

function normalizeOptions(options) {
  validateOptionsShape(options);
  if (!Array.isArray(options.roots) || options.roots.length === 0) fail('INVALID_ROOTS', 'roots must be a non-empty array');
  if (options.roots.length > MAX_ROOTS) fail('LIMIT_EXCEEDED', `roots exceeds ${MAX_ROOTS}`);
  const roots = options.roots.map(normalizeRoot);
  const ids = new Set();
  for (const r of roots) { if (ids.has(r.publicRoot)) fail('DUPLICATE_ROOT', `duplicate root ${r.publicRoot}`); ids.add(r.publicRoot); }
  const queueCapacity = options.queueCapacity ?? 256;
  if (!Number.isInteger(queueCapacity) || queueCapacity < 1 || queueCapacity > MAX_QUEUE) fail('INVALID_QUEUE', 'queueCapacity is invalid');
  const overflow = options.overflow ?? 'reject_new';
  if (!['reject_new', 'drop_oldest', 'drop_newest'].includes(overflow)) fail('INVALID_OVERFLOW', 'unsupported overflow policy');
  const debounceMs = options.debounceMs ?? 0;
  if (!Number.isInteger(debounceMs) || debounceMs < 0 || debounceMs > MAX_DEBOUNCE_MS) fail('INVALID_DEBOUNCE', 'debounceMs is invalid');
  if (options.recursive !== undefined && typeof options.recursive !== 'boolean') fail('INVALID_RECURSIVE', 'recursive must be boolean');
  return immutable({ roots, recursive: options.recursive ?? false, queueCapacity, overflow, debounceMs, source: options.source ?? null });
}

function publicPath(rootPath, candidate) {
  const absolute = resolve(rootPath, candidate);
  const rel = relative(rootPath, absolute);
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) return rel.split(sep).join('/');
  fail('PATH_ESCAPE', 'event path escapes watcher root');
}

function eventSize(event) {
  const bytes = Buffer.byteLength(JSON.stringify(event), 'utf8');
  if (bytes > MAX_EVENT) fail('EVENT_TOO_LARGE', `event exceeds ${MAX_EVENT} bytes`);
}

function classifyNative(root, filename, action) {
  const name = filename == null ? '' : String(filename);
  const path = publicPath(root.path, name);
  if (action === 'change') return { type: 'changed', path };
  if (action === 'rename') return existsSync(resolve(root.path, name)) ? { type: 'created', path } : { type: 'removed', path };
  fail('NATIVE_EVENT', `unsupported native action ${action}`);
}

export function createWatcher(rawOptions) {
  const options = normalizeOptions(rawOptions);
  let state = 'created';
  let sequence = 0;
  let queue = [];
  let waiters = [];
  let watchers = [];
  let pendingTimers = new Map();
  let terminalError = null;
  let sourceEnded = false;
  let closed = false;

  const diagnostics = { overflow: 0, dropped: 0, suppressed: 0 };

  function snapshotStats() { return immutable({ ...diagnostics, queued: queue.length, state }); }

  function emitError(error) {
    terminalError = error instanceof FilesystemWatcherError ? error : new FilesystemWatcherError('SOURCE_FAILURE', 'watch source failed');
    for (const waiter of waiters.splice(0)) waiter.reject(terminalError);
  }

  function enqueue(baseEvent) {
    if (closed) return;
    const event = immutable({
      format: FORMAT,
      sequence: ++sequence,
      rootId: baseEvent.rootId,
      type: baseEvent.type,
      path: baseEvent.path,
      ...(baseEvent.previousPath ? { previousPath: baseEvent.previousPath } : {}),
    });
    eventSize(event);
    const waiter = waiters.shift();
    if (waiter) { waiter.resolve({ value: event, done: false }); return; }
    if (queue.length >= options.queueCapacity) {
      diagnostics.overflow += 1;
      if (options.overflow === 'reject_new') { diagnostics.dropped += 1; return; }
      if (options.overflow === 'drop_oldest') { queue.shift(); diagnostics.dropped += 1; }
      if (options.overflow === 'drop_newest') { diagnostics.dropped += 1; return; }
    }
    queue.push(event);
  }

  function emit(baseEvent) {
    if (options.debounceMs === 0) return enqueue(baseEvent);
    const key = `${baseEvent.rootId}:${baseEvent.path}`;
    const previous = pendingTimers.get(key);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => { pendingTimers.delete(key); enqueue(baseEvent); }, options.debounceMs);
    pendingTimers.set(key, timer);
  }

  function handleNative(root, action, filename) {
    try { emit({ rootId: root.rootId, ...classifyNative(root, filename, action) }); }
    catch (error) { emitError(error); void close(); }
  }

  async function startInjected(source) {
    if (!source || typeof source[Symbol.asyncIterator] !== 'function') fail('INVALID_SOURCE', 'injected source must be AsyncIterable');
    for await (const raw of source) {
      safeData(raw, 'event');
      const type = text(raw.type, 'event.type', 16);
      if (!TYPES.has(type)) fail('INVALID_EVENT', `unsupported event type ${type}`);
      const root = options.roots.find((r) => r.rootId === raw.rootId || r.publicRoot === raw.root);
      if (!root) fail('UNKNOWN_ROOT', 'event references unknown root');
      const path = publicPath(root.path, text(raw.path, 'event.path'));
      const previousPath = raw.previousPath === undefined ? undefined : publicPath(root.path, text(raw.previousPath, 'event.previousPath'));
      emit({ rootId: root.rootId, type, path, previousPath });
      if (closed) break;
    }
    if (!closed && !terminalError) {
      sourceEnded = true;
      for (const waiter of waiters.splice(0)) waiter.resolve({ value: undefined, done: true });
    }
  }

  async function start() {
    if (state === 'running') return snapshotStats();
    if (state === 'closing' || state === 'closed') fail('CLOSED', 'watcher is closed');
    state = 'starting';
    try {
      if (options.source) {
        state = 'running';
        startInjected(options.source).catch((error) => { emitError(error); void close(); });
      } else {
        for (const root of options.roots) {
          const handle = nativeWatch(root.path, { recursive: options.recursive }, (action, filename) => handleNative(root, action, filename));
          handle.on('error', emitError);
          watchers.push(handle);
        }
        state = 'running';
      }
      return snapshotStats();
    } catch (error) {
      emitError(error);
      await close();
      throw error;
    }
  }

  async function next() {
    if (queue.length) return { value: queue.shift(), done: false };
    if (terminalError) return Promise.reject(terminalError);
    if (closed || sourceEnded) return { value: undefined, done: true };
    return new Promise((resolveNext, rejectNext) => waiters.push({ resolve: resolveNext, reject: rejectNext }));
  }

  async function close() {
    if (state === 'closed' || state === 'closing') return snapshotStats();
    state = 'closing';
    closed = true;
    for (const timer of pendingTimers.values()) clearTimeout(timer);
    pendingTimers.clear();
    for (const handle of watchers) { try { handle.close(); } catch { /* cleanup boundary */ } }
    watchers = [];
    queue = [];
    sourceEnded = true;
    for (const waiter of waiters.splice(0)) waiter.resolve({ value: undefined, done: true });
    state = 'closed';
    return snapshotStats();
  }

  function stats() { return snapshotStats(); }

  return Object.freeze({ start, next, close, stats });
}

export const FILESYSTEM_WATCHER_FORMAT = FORMAT;
export const FILESYSTEM_WATCHER_STATES = Object.freeze([...STATES]);
export const FILESYSTEM_WATCHER_EVENT_TYPES = Object.freeze([...TYPES]);
