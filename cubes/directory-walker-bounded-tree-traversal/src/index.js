import { readdir, lstat, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { resolveContained } from '#safe-path-resolver';

const MAX_PATH = 32 * 1024;
const MAX_NAME = 8 * 1024;
const MAX_DEPTH = 1024;
const DEFAULTS = Object.freeze({
  mode: 'collected', maxDepth: 64, maxEntries: 100_000, maxPathLength: MAX_PATH,
  maxNameLength: MAX_NAME, maxDirectoryEntries: 10_000, maxSymlinkDepth: 16,
  maxVisitedDirectories: 100_000, maxWorkUnits: 1_000_000, deadlineMs: null,
  partial: 'none', symlinkPolicy: 'report', includeSpecial: false,
});

export class DirectoryWalkerError extends Error {
  constructor(code, message, details = {}) {
    super(message); this.name = 'DirectoryWalkerError'; this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) { throw new DirectoryWalkerError(code, message, details); }

function assertOptionsContainer(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) fail('INVALID_OPTIONS', 'options must be an object');
  for (const key of Object.getOwnPropertyNames(options)) {
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `options.${key} is accessor-backed`);
  }
}

function validatePlain(value, label, seen = new Set(), depth = 0) {
  if (depth > 16) fail('INVALID_OPTIONS', `${label} exceeds validation depth`);
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

function normalizeOptions(data = {}) {
  validatePlain(data, 'options');
  const out = { ...DEFAULTS, ...data };
  if (!['visitor', 'collected'].includes(out.mode)) fail('INVALID_OPTIONS', 'mode must be visitor or collected');
  if (!['reject', 'report', 'follow-contained'].includes(out.symlinkPolicy)) fail('INVALID_OPTIONS', 'invalid symlinkPolicy');
  if (!['none', 'return'].includes(out.partial)) fail('INVALID_OPTIONS', 'partial must be none or return');
  for (const field of ['maxDepth', 'maxEntries', 'maxPathLength', 'maxNameLength', 'maxDirectoryEntries', 'maxSymlinkDepth', 'maxVisitedDirectories', 'maxWorkUnits']) {
    if (!Number.isInteger(out[field]) || out[field] < 1) fail('INVALID_OPTIONS', `${field} must be a positive integer`);
  }
  if (out.maxDepth > MAX_DEPTH) fail('INVALID_OPTIONS', `maxDepth must be <= ${MAX_DEPTH}`);
  if (out.maxPathLength > MAX_PATH || out.maxNameLength > MAX_NAME) fail('INVALID_OPTIONS', 'path/name limits exceed hard bounds');
  if (out.deadlineMs !== null && (!Number.isFinite(out.deadlineMs) || out.deadlineMs <= 0)) fail('INVALID_OPTIONS', 'deadlineMs must be null or positive');
  if (typeof out.includeSpecial !== 'boolean') fail('INVALID_OPTIONS', 'includeSpecial must be boolean');
  return Object.freeze(out);
}

function assertCapabilities(capabilities) {
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) fail('CAPABILITY_FAILURE', 'capabilities must be an object');
  for (const key of Object.getOwnPropertyNames(capabilities)) {
    const descriptor = Object.getOwnPropertyDescriptor(capabilities, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `capabilities.${key} is accessor-backed`);
    if (typeof descriptor.value !== 'function') fail('CAPABILITY_FAILURE', `${key} must be a function`);
  }
  for (const required of ['readDirectory', 'lstat']) if (typeof capabilities[required] !== 'function') fail('CAPABILITY_FAILURE', `${required} capability is required`);
}

const defaultCapabilities = Object.freeze({
  readDirectory: async (path) => readdir(path, { withFileTypes: true }),
  lstat,
  realpath,
  now: () => performance.now(),
});

function clockNow(capabilities) {
  const value = Number(capabilities.now ? capabilities.now() : performance.now());
  if (!Number.isFinite(value)) fail('CAPABILITY_FAILURE', 'now capability must return a finite number');
  return value;
}

function makeState(root, canonicalRoot, options, capabilities, signal, onEntry) {
  const start = clockNow(capabilities);
  return { root, canonicalRoot, options, capabilities, signal, onEntry, start, work: 0, entries: 0, visitedDirectories: 0 };
}

function checkpoint(state, weight = 1) {
  state.work += weight;
  if (state.work > state.options.maxWorkUnits) fail('WORK_BUDGET_EXCEEDED', 'work budget exceeded', { work: state.work, maxWorkUnits: state.options.maxWorkUnits });
  if (state.options.deadlineMs !== null && clockNow(state.capabilities) - state.start >= state.options.deadlineMs) fail('DEADLINE_EXCEEDED', 'deadline exceeded');
  if (state.signal?.aborted) fail('ABORTED', 'traversal aborted');
}

function relativePath(root, path) {
  const value = relative(root, path).split(sep).join('/');
  return value || '.';
}
function logicalPath(parent, name) { return parent === '.' ? name : `${parent}/${name}`; }
function compareStrings(a, b) { const left = String(a); const right = String(b); return left === right ? 0 : (left < right ? -1 : 1); }
function classifyDirent(entry) {
  if (entry?.isDirectory?.()) return 'directory';
  if (entry?.isFile?.()) return 'file';
  if (entry?.isSymbolicLink?.()) return 'symlink';
  if (entry?.isSocket?.() || entry?.isBlockDevice?.() || entry?.isCharacterDevice?.() || entry?.isFIFO?.()) return 'special';
  return 'unknown';
}
async function call(capabilities, name, input) {
  try { return await capabilities[name](input); }
  catch (error) { fail('CAPABILITY_FAILURE', `${name} failed`, { cause: error instanceof Error ? error.message : String(error) }); }
}
function makeEntry(path, depth, type, metadata = {}) { return Object.freeze({ path, type, depth, ...metadata }); }

async function listChildren(state, node) {
  checkpoint(state); state.visitedDirectories += 1;
  if (state.visitedDirectories > state.options.maxVisitedDirectories) fail('ENTRY_LIMIT_EXCEEDED', 'visited directory limit exceeded');
  const raw = await call(state.capabilities, 'readDirectory', node.absolute);
  if (!Array.isArray(raw)) fail('CAPABILITY_FAILURE', 'readDirectory must return an array');
  if (raw.length > state.options.maxDirectoryEntries) fail('DIRECTORY_ENTRY_LIMIT_EXCEEDED', 'directory entry limit exceeded', { path: node.displayPath });
  const normalized = [];
  for (const child of raw) {
    checkpoint(state);
    const name = typeof child?.name === 'string' ? child.name : null;
    if (!name || name.includes('\0') || name.length > state.options.maxNameLength) fail('PATH_LIMIT_EXCEEDED', 'entry name is invalid or exceeds limit', { path: node.displayPath });
    normalized.push({ name, type: classifyDirent(child) });
  }
  normalized.sort((a, b) => compareStrings(a.name, b.name));
  return normalized;
}

async function inspectSymlink(state, absolutePath, displayPath, nextSymlinkDepth) {
  if (state.options.symlinkPolicy === 'reject') fail('SPECIAL_ENTRY_REJECTED', 'symlink rejected by policy', { path: displayPath });
  if (state.options.symlinkPolicy === 'report') return { follow: false, target: null };
  if (nextSymlinkDepth > state.options.maxSymlinkDepth) fail('SYMLINK_DEPTH_EXCEEDED', 'maximum symlink depth exceeded', { path: displayPath });
  if (typeof state.capabilities.realpath !== 'function') fail('CAPABILITY_FAILURE', 'follow-contained requires realpath capability');
  const target = await call(state.capabilities, 'realpath', absolutePath);
  if (typeof target !== 'string' || !target) fail('CAPABILITY_FAILURE', 'realpath must return a non-empty path');
  try { resolveContained(state.canonicalRoot, target, { separatorNormalization: true, normalizeDotSegments: true }); }
  catch { fail('ROOT_ESCAPE', 'symlink resolves outside traversal root', { path: displayPath }); }
  return { follow: true, target };
}

export async function walk(root, options = {}, capabilities = defaultCapabilities) {
  if (typeof root !== 'string' || !root || root.includes('\0')) fail('INVALID_ROOT', 'root must be a non-empty NUL-free string');
  assertOptionsContainer(options);
  const optionDescriptors = Object.getOwnPropertyNames(options);
  const onEntry = Object.prototype.hasOwnProperty.call(options, 'onEntry') ? options.onEntry : undefined;
  const signal = Object.prototype.hasOwnProperty.call(options, 'signal') ? options.signal : undefined;
  if (onEntry !== undefined && typeof onEntry !== 'function') fail('INVALID_OPTIONS', 'onEntry must be a function');
  if (signal !== undefined && (typeof signal !== 'object' || typeof signal.aborted !== 'boolean')) fail('INVALID_OPTIONS', 'signal must be AbortSignal-compatible');
  const dataOptions = {};
  for (const key of optionDescriptors) if (key !== 'onEntry' && key !== 'signal') dataOptions[key] = options[key];
  const opts = normalizeOptions(dataOptions);
  assertCapabilities(capabilities);
  if (opts.mode === 'visitor' && typeof onEntry !== 'function') fail('INVALID_OPTIONS', 'visitor mode requires onEntry');
  const canonicalRoot = opts.symlinkPolicy === 'follow-contained'
    ? await call(capabilities, 'realpath', root)
    : root;
  if (typeof canonicalRoot !== 'string' || !canonicalRoot) fail('CAPABILITY_FAILURE', 'canonical root must be a non-empty path');
  const state = makeState(root, canonicalRoot, opts, capabilities, signal, onEntry);
  const result = [];
  const stack = [{ absolute: root, displayPath: '.', depth: 0, symlinkDepth: 0, ancestry: new Set([canonicalRoot]), children: null, index: 0 }];

  const deliver = async (entry) => {
    checkpoint(state); state.entries += 1;
    if (state.entries > opts.maxEntries) fail('ENTRY_LIMIT_EXCEEDED', 'maximum entry count exceeded');
    if (opts.mode === 'visitor') {
      try { await state.onEntry(entry); } catch (error) { fail('VISITOR_FAILURE', error instanceof Error ? error.message : String(error)); }
    } else result.push(entry);
  };

  try {
    while (stack.length) {
      checkpoint(state);
      const frame = stack[stack.length - 1];
      if (frame.children === null) {
        if (frame.depth >= opts.maxDepth && frame.depth !== 0) fail('DEPTH_LIMIT_EXCEEDED', 'maximum traversal depth exceeded', { path: frame.displayPath });
        frame.children = await listChildren(state, frame);
      }
      if (frame.index >= frame.children.length) { stack.pop(); continue; }
      const child = frame.children[frame.index++];
      checkpoint(state);
      const absolute = join(frame.absolute, child.name);
      const displayPath = logicalPath(frame.displayPath, child.name);
      if (displayPath.length > opts.maxPathLength) fail('PATH_LIMIT_EXCEEDED', 'path exceeds maximum length', { path: displayPath });
      const depth = frame.depth + 1;

      if (child.type === 'directory') {
        await deliver(makeEntry(displayPath, depth, 'directory'));
        stack.push({ absolute, displayPath, depth, symlinkDepth: frame.symlinkDepth, ancestry: new Set(frame.ancestry), children: null, index: 0 });
        continue;
      }

      if (child.type === 'symlink') {
        if (opts.symlinkPolicy === 'report') { await deliver(makeEntry(displayPath, depth, 'symlink')); continue; }
        const link = await inspectSymlink(state, absolute, displayPath, frame.symlinkDepth + 1);
        const canonical = link.target;
        if (frame.ancestry.has(canonical)) fail('SYMLINK_CYCLE', 'symlink cycle detected', { path: displayPath });
        const targetStat = await call(state.capabilities, 'lstat', canonical);
        await deliver(makeEntry(displayPath, depth, 'symlink', { target: relativePath(state.canonicalRoot, canonical), followed: true }));
        if (targetStat?.isDirectory?.()) {
          stack.push({ absolute: canonical, displayPath, depth, symlinkDepth: frame.symlinkDepth + 1, ancestry: new Set([...frame.ancestry, canonical]), children: null, index: 0 });
        }
        continue;
      }

      if (child.type === 'special' && !opts.includeSpecial) continue;
      if (child.type === 'unknown') fail('SPECIAL_ENTRY_REJECTED', 'unknown filesystem entry type rejected', { path: displayPath });
      await deliver(makeEntry(displayPath, depth, child.type));
    }
    return opts.mode === 'visitor'
      ? Object.freeze({ mode: 'visitor', entries: state.entries, work: state.work })
      : Object.freeze(result.map((item) => Object.freeze({ ...item })));
  } catch (error) {
    if (opts.partial === 'return') return Object.freeze({ partial: true, result: opts.mode === 'visitor' ? null : Object.freeze(result.map((item) => Object.freeze({ ...item }))), error: Object.freeze({ code: error.code ?? 'FILESYSTEM_FAILURE', message: error.message }) });
    throw error;
  }
}

export { defaultCapabilities };
