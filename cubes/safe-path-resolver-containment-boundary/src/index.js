const FORMAT = 'SPR1';
const MAX_PATH = 32 * 1024;
const MAX_SEGMENTS = 1024;
const MAX_SYMLINK_DEPTH = 64;
const MAX_SERIALIZED = 256 * 1024;

export class SafePathResolverError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SafePathResolverError';
    this.code = code;
  }
}

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function fail(code, message) {
  throw new SafePathResolverError(code, message);
}

function validatePlain(value, label, seen = new Set(), depth = 0) {
  if (depth > 16) fail('LIMIT_EXCEEDED', `${label} exceeds validation depth`);
  if (value === null) return;
  const type = typeof value;
  if (type === 'function' || type === 'symbol' || type === 'bigint' || type === 'undefined') {
    fail('CAPABILITY_RESULT_INVALID', `${label} contains unsupported executable/non-data input`);
  }
  if (type === 'number' && !Number.isFinite(value)) fail('CAPABILITY_RESULT_INVALID', `${label} contains a non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) fail('CAPABILITY_RESULT_INVALID', `${label} must be plain data`);
  seen.add(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    validatePlain(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function validateOptions(options = {}) {
  validatePlain(options, 'options');
  const normalized = {
    separatorNormalization: options.separatorNormalization ?? true,
    normalizeDotSegments: options.normalizeDotSegments ?? true,
    caseMode: options.caseMode ?? 'sensitive',
    preserveNamespace: options.preserveNamespace ?? true,
    maxSegments: options.maxSegments ?? MAX_SEGMENTS,
    symlinkPolicy: options.symlinkPolicy ?? 'lexical-only',
    maxSymlinkDepth: options.maxSymlinkDepth ?? MAX_SYMLINK_DEPTH,
  };
  if (typeof normalized.separatorNormalization !== 'boolean') fail('INVALID_PATH', 'separatorNormalization must be boolean');
  if (typeof normalized.normalizeDotSegments !== 'boolean') fail('INVALID_PATH', 'normalizeDotSegments must be boolean');
  if (!['sensitive', 'insensitive'].includes(normalized.caseMode)) fail('INVALID_PATH', 'caseMode must be sensitive or insensitive');
  if (typeof normalized.preserveNamespace !== 'boolean') fail('INVALID_PATH', 'preserveNamespace must be boolean');
  if (!Number.isInteger(normalized.maxSegments) || normalized.maxSegments < 1 || normalized.maxSegments > MAX_SEGMENTS) fail('LIMIT_EXCEEDED', `maxSegments must be between 1 and ${MAX_SEGMENTS}`);
  if (!['lexical-only', 'reject-symlink', 'follow-contained'].includes(normalized.symlinkPolicy)) fail('SYMLINK_REJECTED', 'invalid symlink policy');
  if (!Number.isInteger(normalized.maxSymlinkDepth) || normalized.maxSymlinkDepth < 1 || normalized.maxSymlinkDepth > MAX_SYMLINK_DEPTH) fail('LIMIT_EXCEEDED', `maxSymlinkDepth must be between 1 and ${MAX_SYMLINK_DEPTH}`);
  return Object.freeze(normalized);
}

function validatePathInput(value, label) {
  if (typeof value !== 'string') fail('INVALID_PATH', `${label} must be a string`);
  if (!value || value.includes('\0')) fail('INVALID_PATH', `${label} must be non-empty and NUL-free`);
  if (value.length > MAX_PATH) fail('LIMIT_EXCEEDED', `${label} exceeds ${MAX_PATH} characters`);
}

function normalizeSeparators(value, options) {
  if (!options.separatorNormalization) return value;
  return value.replaceAll('\\', '/');
}

function rootDescriptor(value) {
  if (value.startsWith('//?/UNC/')) {
    const remainder = value.slice('//?/UNC/'.length);
    const parts = remainder.split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) fail('ROOT_MISMATCH', 'invalid UNC namespace root');
    return { kind: 'namespace-unc', identity: `namespace-unc:${parts[0]}/${parts[1]}`, prefix: `//?/UNC/${parts[0]}/${parts[1]}`, rest: parts.slice(2) };
  }
  if (value.startsWith('//?/')) {
    const remainder = value.slice('//?/');
    if (!/^[A-Za-z]:\//.test(remainder)) fail('ROOT_MISMATCH', 'unsupported Windows namespace root');
    return { kind: 'namespace-drive', identity: `namespace-drive:${remainder.slice(0, 2).toUpperCase()}`, prefix: `//?/${remainder.slice(0, 2).toUpperCase()}`, rest: remainder.slice(3).split('/') };
  }
  if (/^[A-Za-z]:\//.test(value)) {
    const drive = value.slice(0, 2).toUpperCase();
    return { kind: 'drive', identity: `drive:${drive}`, prefix: `${drive}/`, rest: value.slice(3).split('/') };
  }
  if (value.startsWith('//')) {
    const parts = value.slice(2).split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) fail('ROOT_MISMATCH', 'invalid UNC root');
    return { kind: 'unc', identity: `unc:${parts[0]}/${parts[1]}`, prefix: `//${parts[0]}/${parts[1]}`, rest: parts.slice(2) };
  }
  if (value.startsWith('/')) return { kind: 'posix', identity: 'posix:/', prefix: '/', rest: value.slice(1).split('/') };
  return { kind: 'relative', identity: '', prefix: '', rest: value.split('/') };
}

function normalizeSegments(rawSegments, descriptor, options) {
  if (rawSegments.length > options.maxSegments) fail('LIMIT_EXCEEDED', `path exceeds ${options.maxSegments} segments`);
  const out = [];
  for (const segment of rawSegments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (!options.normalizeDotSegments) {
        out.push(segment);
        continue;
      }
      if (out.length > 0 && out.at(-1) !== '..') {
        out.pop();
        continue;
      }
      if (descriptor.kind !== 'relative') fail('TRAVERSAL_ESCAPE', 'path escapes an absolute root');
      fail('TRAVERSAL_ESCAPE', 'relative path escapes its caller-defined scope');
    }
    if (segment.includes('\0')) fail('INVALID_PATH', 'path segment contains NUL');
    out.push(segment);
    if (out.length > options.maxSegments) fail('LIMIT_EXCEEDED', `path exceeds ${options.maxSegments} segments`);
  }
  return out;
}

function formatDescriptor(descriptor, segments) {
  const body = segments.join('/');
  if (descriptor.kind === 'relative') return body || '.';
  if (descriptor.kind === 'posix') return body ? `/${body}` : '/';
  if (descriptor.kind === 'drive') return body ? `${descriptor.prefix}${body}` : descriptor.prefix;
  if (descriptor.kind === 'unc') return body ? `${descriptor.prefix}/${body}` : descriptor.prefix;
  if (descriptor.kind === 'namespace-drive') return body ? `${descriptor.prefix}/${body}` : descriptor.prefix;
  if (descriptor.kind === 'namespace-unc') return body ? `${descriptor.prefix}/${body}` : descriptor.prefix;
  fail('ROOT_MISMATCH', 'unsupported root descriptor');
}

function parseAndNormalize(value, options = {}) {
  validatePathInput(value, 'path');
  const opts = validateOptions(options);
  const normalizedInput = normalizeSeparators(value, opts);
  if (/^[A-Za-z]:[^/]/.test(normalizedInput)) fail('ROOT_MISMATCH', 'drive-relative paths such as C:foo are rejected');
  const descriptor = rootDescriptor(normalizedInput);
  const segments = normalizeSegments(descriptor.rest, descriptor, opts);
  return Object.freeze({
    format: FORMAT,
    root: Object.freeze({ kind: descriptor.kind, identity: descriptor.identity, prefix: descriptor.prefix }),
    absolute: descriptor.kind !== 'relative',
    segments: Object.freeze([...segments]),
    path: formatDescriptor(descriptor, segments),
    options: opts,
  });
}

function normalizeCase(value, caseMode) {
  return caseMode === 'insensitive' ? value.toLocaleLowerCase('en-US') : value;
}

function sameRoot(left, right, caseMode) {
  return normalizeCase(left.identity, caseMode) === normalizeCase(right.identity, caseMode);
}

function segmentCompare(left, right, caseMode) {
  const a = normalizeCase(left, caseMode);
  const b = normalizeCase(right, caseMode);
  return a === b ? 0 : (a < b ? -1 : 1);
}

function containsNormalized(candidate, root, options) {
  if (!sameRoot(candidate.root, root.root, options.caseMode)) return false;
  if (!candidate.absolute || !root.absolute) return false;
  if (candidate.segments.length < root.segments.length) return false;
  for (let index = 0; index < root.segments.length; index += 1) {
    if (segmentCompare(candidate.segments[index], root.segments[index], options.caseMode) !== 0) return false;
  }
  return true;
}

function canonicalPayload(value) {
  validatePlain(value, 'payload');
  return JSON.stringify(value, (_, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
    return item;
  });
}

async function callCapability(capabilities, name, argument, label) {
  const fn = capabilities?.[name];
  if (typeof fn !== 'function') fail('CAPABILITY_UNAVAILABLE', `${name} capability is unavailable`);
  let result;
  try { result = await fn(argument); } catch (error) { fail('CAPABILITY_RESULT_INVALID', `${label} capability failed: ${error instanceof Error ? error.message : 'unknown error'}`); }
  if (typeof result !== 'string') fail('CAPABILITY_RESULT_INVALID', `${label} capability must return a path string`);
  validatePathInput(result, label);
  return result;
}

function assertCapabilityContainer(capabilities) {
  if (capabilities === undefined) fail('CAPABILITY_UNAVAILABLE', 'filesystem capability container is required');
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) fail('CAPABILITY_RESULT_INVALID', 'capabilities must be an object');
  for (const key of Object.getOwnPropertyNames(capabilities)) {
    const descriptor = Object.getOwnPropertyDescriptor(capabilities, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `capabilities.${key} is accessor-backed`);
  }
}

export function normalizePath(input, options = {}) {
  return parseAndNormalize(input, options).path;
}

export function resolvePath(base, input, options = {}) {
  validatePathInput(base, 'base');
  validatePathInput(input, 'input');
  const opts = validateOptions(options);
  const normalizedInput = normalizeSeparators(input, opts);
  const inputDescriptor = rootDescriptor(normalizedInput);
  if (inputDescriptor.kind !== 'relative') return parseAndNormalize(normalizedInput, opts).path;
  const normalizedBase = parseAndNormalize(base, opts);
  if (!normalizedBase.absolute) fail('MISSING_BASE', 'base must be absolute for safe resolution');
  const combined = formatDescriptor(normalizedBase.root, normalizedBase.segments) + (normalizedBase.path.endsWith('/') ? '' : '/') + normalizedInput;
  return parseAndNormalize(combined, opts).path;
}

export function isContained(path, root, options = {}) {
  const opts = validateOptions(options);
  const candidate = parseAndNormalize(path, opts);
  const normalizedRoot = parseAndNormalize(root, opts);
  const contained = containsNormalized(candidate, normalizedRoot, opts);
  return Object.freeze({
    format: FORMAT,
    status: contained ? 'contained' : 'outside',
    path: candidate.path,
    root: normalizedRoot.path,
    reason: contained ? 'segment-contained' : (!sameRoot(candidate.root, normalizedRoot.root, opts.caseMode) ? 'root-mismatch' : 'segment-outside'),
  });
}

export function resolveContained(root, input, options = {}) {
  const opts = validateOptions(options);
  const resolved = resolvePath(root, input, opts);
  const report = isContained(resolved, root, opts);
  if (report.status !== 'contained') fail(report.reason === 'root-mismatch' ? 'ROOT_MISMATCH' : 'TRAVERSAL_ESCAPE', `resolved path is outside root: ${resolved}`);
  return resolved;
}

export async function canonicalizePath(input, root, capabilities, options = {}) {
  const opts = validateOptions(options);
  assertCapabilityContainer(capabilities);
  const policy = opts.symlinkPolicy;
  const lexicalInput = resolvePath(root, input, opts);
  if (policy === 'lexical-only') return Object.freeze({ format: FORMAT, policy, path: lexicalInput, status: isContained(lexicalInput, root, opts).status });
  const canonicalRoot = await callCapability(capabilities, 'realpath', root, 'root realpath');
  const canonicalInput = await callCapability(capabilities, 'realpath', lexicalInput, 'path realpath');
  const containment = isContained(canonicalInput, canonicalRoot, opts);
  if (containment.status !== 'contained') fail('SYMLINK_ESCAPE', `canonical path escapes root: ${canonicalInput}`);
  if (policy === 'reject-symlink' && typeof capabilities.lstat === 'function') {
    const lstatResult = await capabilities.lstat(lexicalInput);
    if (!lstatResult || lstatResult.isSymbolicLink === true) fail('SYMLINK_REJECTED', 'symlink destination rejected');
  }
  return Object.freeze({ format: FORMAT, policy, path: normalizePath(canonicalInput, opts), root: normalizePath(canonicalRoot, opts), status: 'contained' });
}

export function comparePaths(left, right, options = {}) {
  const opts = validateOptions(options);
  const a = parseAndNormalize(left, opts);
  const b = parseAndNormalize(right, opts);
  if (!sameRoot(a.root, b.root, opts.caseMode)) return a.root.identity < b.root.identity ? -1 : 1;
  const length = Math.min(a.segments.length, b.segments.length);
  for (let index = 0; index < length; index += 1) {
    const comparison = segmentCompare(a.segments[index], b.segments[index], opts.caseMode);
    if (comparison !== 0) return comparison;
  }
  return a.segments.length === b.segments.length ? 0 : (a.segments.length < b.segments.length ? -1 : 1);
}

export function serializeReport(report) {
  validatePlain(report, 'report');
  const envelope = { format: FORMAT, version: 1, payload: canonicalPayload(report) };
  if (Buffer.byteLength(envelope.payload, 'utf8') > MAX_SERIALIZED) fail('LIMIT_EXCEEDED', `report exceeds ${MAX_SERIALIZED} bytes`);
  return JSON.stringify(envelope);
}

export function parseReport(serialized) {
  if (typeof serialized !== 'string' || !serialized) fail('MALFORMED_SERIALIZATION', 'serialized report must be a non-empty string');
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED) fail('LIMIT_EXCEEDED', `serialized report exceeds ${MAX_SERIALIZED} bytes`);
  let envelope;
  try { envelope = JSON.parse(serialized); } catch { fail('MALFORMED_SERIALIZATION', 'serialized report is invalid JSON'); }
  validatePlain(envelope, 'envelope');
  if (envelope.format !== FORMAT || envelope.version !== 1 || typeof envelope.payload !== 'string') fail('MALFORMED_SERIALIZATION', 'serialized report envelope is invalid');
  let payload;
  try { payload = JSON.parse(envelope.payload); } catch { fail('MALFORMED_SERIALIZATION', 'serialized report payload is invalid JSON'); }
  validatePlain(payload, 'payload');
  return Object.freeze(payload);
}

export const SAFE_PATH_RESOLVER_FORMAT = FORMAT;
export const SAFE_PATH_RESOLVER_LIMITS = Object.freeze({ MAX_PATH, MAX_SEGMENTS, MAX_SYMLINK_DEPTH, MAX_SERIALIZED });
