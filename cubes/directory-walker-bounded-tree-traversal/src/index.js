import { readdir, lstat, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { resolveContained } from '../../safe-path-resolver-containment-boundary/src/index.js';

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
  constructor(code, message, details = {}) { super(message); this.name = 'DirectoryWalkerError'; this.code = code; this.details = Object.freeze({ ...details }); }
}
function fail(code, message, details) { throw new DirectoryWalkerError(code, message, details); }

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

function makeState(root, options, capabilities, signal, onEntry) {
  const start = capabilities.now ? Number(awaitableNow(capabilities)) : performance.now();
  return { root, options, capabilities, signal, onEntry, start, work: 0, entries: 0, visitedDirectories: 0 };
}
function awaitableNow(capabilities) { try { return capabilities.now(); } catch { return performance.now(); } }
function now(state) { return state.capabilities.now ? Number(awaitableNow(state.capabilities)) : performance.now(); }

function checkpoint(state, weight = 1) {
  state.work += weight;
  if (state.work > state.options.maxWorkUnits) fail('WORK_BUDGET_EXCEEDED', 'work budget exceeded', { work: state.work, maxWorkUnits: state.options.maxWorkUnits });
  if (state.options.deadlineMs !== null && now(state) - state.start >= state.options.deadlineMs) fail('DEADLINE_EXCEEDED', 'deadline exceeded');
  if (state.signal?.aborted) fail('ABORTED', 'traversal aborted');
}
function relativePath(root, path) { const value = relative(root, path).split(sep).join('/'); return value || '.'; }
function compareStrings(a, b) { const left = String(a); const right = String(b); return left === right ? 0 : (left < right ? -1 : 1); }
function classifyDirent(entry) {
  if (entry?.isDirectory?.()) return 'directory'; if (entry?.isFile?.()) return 'file'; if (entry?.isSymbolicLink?.()) return 'symlink';
  if (entry?.isSocket?.() || entry?.isBlockDevice?.() || entry?.isCharacterDevice?.() || entry?.isFIFO?.()) return 'special'; return 'unknown';
}
async function call(capabilities, name, input) {
  try { return await capabilities[name](input); } catch (error) { fail('CAPABILITY_FAILURE', `${name} failed`, { cause: error instanceof Error ? error.message : String(error) }); }
}
function makeEntry(root, absolutePath, depth, type, metadata = {}) { return Object.freeze({ path: relativePath(root, absolutePath), type, depth, ...metadata }); }

async function listChildren(state, node) {
  checkpoint(state); state.visitedDirectories += 1;
  if (state.visitedDirectories > state.options.maxVisitedDirectories) fail('ENTRY_LIMIT_EXCEEDED', 'visited directory limit exceeded');
  const raw = await call(state.capabilities, 'readDirectory', node.absolute);
  if (!Array.isArray(raw)) fail('CAPABILITY_FAILURE', 'readDirectory must return an array');
  if (raw.length > state.options.maxDirectoryEntries) fail('DIRECTORY_ENTRY_LIMIT_EXCEEDED', 'directory entry limit exceeded', { path: node.relative });
  const normalized = [];
  for (const child of raw) {
    checkpoint(state); const name = typeof child?.name === 'string' ? child.name : null;
    if (!name || name.includes('\0') || name.length > state.options.maxNameLength) fail('PATH_LIMIT_EXCEEDED', 'entry name is invalid or exceeds limit', { path: node.relative });
    normalized.push({ name, type: classifyDirent(child) });
  }
  normalized.sort((a, b) => compareStrings(a.name, b.name)); return normalized;
}

async function inspectSymlink(state, absolutePath) {
  if (state.options.symlinkPolicy === 'reject') fail('SPECIAL_ENTRY_REJECTED', 'symlink rejected by policy', { path: relativePath(state.root, absolutePath) });
  if (state.options.symlinkPolicy === 'report') return { follow: false, target: null };
  if (typeof state.capabilities.realpath !== 'function') fail('CAPABILITY_FAILURE', 'follow-contained requires realpath capability');
  const target = await call(state.capabilities, 'realpath', absolutePath);
  if (typeof target !== 'string' || !target) fail('CAPABILITY_FAILURE', 'realpath must return a non-empty path');
  try { resolveContained(state.root, target, { separatorNormalization: true, normalizeDotSegments: true }); }
  catch { fail('ROOT_ESCAPE', 'symlink resolves outside traversal root', { path: relativePath(state.root, absolutePath) }); }
  return { follow: true, target };
}

export async function walk(root, options = {}, capabilities = defaultCapabilities) {
  if (typeof root !== 'string' || !root || root.includes('\0')) fail('INVALID_ROOT', 'root must be a non-empty NUL-free string');
  const { onEntry, signal, ...dataOptions } = options ?? {};
  if (onEntry !== undefined && typeof onEntry !== 'function') fail('INVALID_OPTIONS', 'onEntry must be a function');
  if (signal !== undefined && (typeof signal !== 'object' || typeof signal.aborted !== 'boolean')) fail('INVALID_OPTIONS', 'signal must be AbortSignal-compatible');
  const opts = normalizeOptions(dataOptions); assertCapabilities(capabilities);
  if (opts.mode === 'visitor' && typeof onEntry !== 'function') fail('INVALID_OPTIONS', 'visitor mode requires onEntry');
  const state = makeState(root, opts, capabilities, signal, onEntry);
  const result = []; const stack = [{ absolute: root, relative: '.', depth: 0, ancestry: new Set([root]) }];

  const deliver = async (entry) => {
    checkpoint(state); state.entries += 1;
    if (state.entries > opts.maxEntries) fail('ENTRY_LIMIT_EXCEEDED', 'maximum entry count exceeded');
    if (opts.mode === 'visitor') { try { await state.onEntry(entry); } catch (error) { fail('VISITOR_FAILURE', error instanceof Error ? error.message : String(error)); } }
    else result.push(entry);
  };

  try {
    while (stack.length) {
      checkpoint(state); const node = stack.pop();
      if (node.depth > opts.maxDepth) fail('DEPTH_LIMIT_EXCEEDED', 'maximum traversal depth exceeded', { path: node.relative });
      const children = await listChildren(state, node);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index]; checkpoint(state); const absolute = join(node.absolute, child.name); const rel = relativePath(root, absolute);
        if (rel.length > opts.maxPathLength) fail('PATH_LIMIT_EXCEEDED', 'path exceeds maximum length', { path: rel });
        if (child.type === 'directory') {
          const entry = makeEntry(root, absolute, node.depth + 1, 'directory'); await deliver(entry);
          if (node.depth + 1 < opts.maxDepth) stack.push({ absolute, relative: rel, depth: node.depth + 1, ancestry: new Set([...node.ancestry, absolute]) });
          continue;
        }
        if (child.type === 'symlink') {
          if (opts.symlinkPolicy === 'reject') { await deliver(makeEntry(root, absolute, node.depth + 1, 'symlink')); continue; }
          if (opts.symlinkPolicy === 'report') { await deliver(makeEntry(root, absolute, node.depth + 1, 'symlink')); continue; }
          const link = await inspectSymlink(state, absolute); const canonical = link.target;
          if (node.ancestry.has(canonical)) fail('SYMLINK_CYCLE', 'symlink cycle detected', { path: rel });
          const targetStat = await call(state.capabilities, 'lstat', canonical);
          if (targetStat?.isDirectory?.() && node.depth + 1 < opts.maxDepth) stack.push({ absolute: canonical, relative: rel, depth: node.depth + 1, ancestry: new Set([...node.ancestry, canonical]) });
          await deliver(makeEntry(root, absolute, node.depth + 1, 'symlink', { target: relativePath(root, canonical), followed: true }));
          continue;
        }
        if (child.type === 'special' && !opts.includeSpecial) continue;
        await deliver(makeEntry(root, absolute, node.depth + 1, child.type));
      }
    }
    return opts.mode === 'visitor' ? Object.freeze({ mode: 'visitor', entries: state.entries, work: state.work }) : Object.freeze(result.map((item) => Object.freeze({ ...item })));
  } catch (error) {
    if (opts.partial === 'return') return Object.freeze({ partial: true, result: opts.mode === 'visitor' ? null : Object.freeze(result.map((item) => Object.freeze({ ...item }))), error: Object.freeze({ code: error.code ?? 'FILESYSTEM_FAILURE', message: error.message }) });
    throw error;
  }
}

export { defaultCapabilities };
