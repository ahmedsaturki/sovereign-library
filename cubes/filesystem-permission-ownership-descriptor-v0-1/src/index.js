import { createHash, timingSafeEqual } from 'node:crypto';

const FORMAT = 'PPO1';
const VERSION = 1;
const MAX_PATH_LENGTH = 4096;
const MAX_IDENTIFIER_LENGTH = 512;
const MAX_FLAGS = 64;
const MAX_FLAG_LENGTH = 128;
const MAX_ACL_ENTRIES = 256;
const MAX_SERIALIZED_BYTES = 32768;
const PLATFORM_NAMES = new Set(['windows', 'linux', 'macos', 'wsl', 'other']);
const TRI_STATE = new Set([true, false, 'unknown']);

class PermissionOwnershipError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PermissionOwnershipError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function rejectAccessors(value, path = '$', seen = new Set()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) throw new PermissionOwnershipError('CIRCULAR_INPUT', 'Circular input rejected');
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    const label = typeof key === 'symbol' ? key.toString() : key;
    if (descriptor?.get || descriptor?.set) {
      throw new PermissionOwnershipError('ACCESSOR_INPUT', `Accessor input rejected at ${path}.${label}`);
    }
    if ('value' in descriptor) rejectAccessors(descriptor.value, `${path}.${label}`, seen);
  }
  seen.delete(value);
}

function assertPlainOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new PermissionOwnershipError('INVALID_OPTIONS', 'Options must be an object');
  }
  rejectAccessors(options);
  for (const name of ['includeOwnerName', 'includeGroupName', 'includeOwnerId', 'includeGroupId']) {
    if (options[name] !== undefined && typeof options[name] !== 'boolean') {
      throw new PermissionOwnershipError('INVALID_OPTIONS', `${name} must be boolean`);
    }
  }
  if (options.ownerRedaction !== undefined && !['none', 'hash'].includes(options.ownerRedaction)) {
    throw new PermissionOwnershipError('INVALID_OPTIONS', 'ownerRedaction must be none or hash');
  }
}

function hashText(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function freezeDeep(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (seen.has(value)) throw new PermissionOwnershipError('CIRCULAR_INPUT', 'Circular value cannot be frozen');
  seen.add(value);
  for (const child of Object.values(value)) freezeDeep(child, seen);
  seen.delete(value);
  return Object.freeze(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function normalizePlatform(platform) {
  const value = String(platform ?? '').toLowerCase();
  if (value === 'win32' || value === 'windows') return 'windows';
  if (value === 'darwin' || value === 'macos' || value === 'mac') return 'macos';
  if (value === 'linux') return 'linux';
  if (value === 'wsl') return 'wsl';
  return 'other';
}

function normalizePath(path) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new PermissionOwnershipError('INVALID_PATH', 'path must be a non-empty string');
  }
  if (path.length > MAX_PATH_LENGTH) {
    throw new PermissionOwnershipError('LIMIT_EXCEEDED', 'path exceeds the maximum length');
  }
  return path;
}

function isAbsolutePath(path) {
  return path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path);
}

function normalizeMode(mode) {
  if (mode === null || mode === undefined) return null;
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o7777) {
    throw new PermissionOwnershipError('INVALID_STAT', 'mode must be a valid POSIX mode integer');
  }
  return mode;
}

function normalizeSafeInteger(value, field) {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PermissionOwnershipError('INVALID_STAT', `${field} must be a non-negative safe integer`);
  }
  return value;
}

function normalizeOpaqueIdentifier(value, field, exposed) {
  if (value === null || value === undefined) return null;
  if (!(typeof value === 'string' || Number.isSafeInteger(value))) {
    throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', `${field} must be a bounded string or safe integer`);
  }
  const text = String(value);
  if (text.length > MAX_IDENTIFIER_LENGTH) {
    throw new PermissionOwnershipError('LIMIT_EXCEEDED', `${field} exceeds ${MAX_IDENTIFIER_LENGTH} characters`);
  }
  return exposed ? value : null;
}

function normalizeName(raw, field, include, redaction, hash) {
  const value = raw?.[field];
  if (value === null || value === undefined) return { value: null, present: false };
  if (typeof value !== 'string') throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', `${field} must be a string or null`);
  if (value.length > MAX_IDENTIFIER_LENGTH) {
    throw new PermissionOwnershipError('LIMIT_EXCEEDED', `${field} exceeds ${MAX_IDENTIFIER_LENGTH} characters`);
  }
  if (!include) return { value: null, present: true };
  return { value: redaction === 'none' ? value : `sha256:${hash(value)}`, present: true };
}

function normalizeOwner(raw, options, kind, hash) {
  const idField = kind === 'owner' ? 'uid' : 'gid';
  const nameField = kind === 'owner' ? 'username' : 'groupname';
  const includeId = kind === 'owner' ? options.includeOwnerId : options.includeGroupId;
  const includeName = kind === 'owner' ? options.includeOwnerName : options.includeGroupName;
  const idPresent = raw?.[idField] !== undefined && raw?.[idField] !== null;
  const id = normalizeOpaqueIdentifier(raw?.[idField], idField, includeId);
  const name = normalizeName(raw, nameField, includeName, options.ownerRedaction ?? 'hash', hash);
  const present = idPresent || name.present;
  return Object.freeze({
    state: present ? (includeId || includeName ? 'known' : 'redacted') : 'unknown',
    id,
    name: name.value,
  });
}

function deriveTriState(mode, shift) {
  if (mode === null) return 'unknown';
  return (mode & (0o4 << shift)) !== 0;
}

function normalizePermissions(platform, mode, readonly) {
  if (platform === 'windows') {
    return Object.freeze({
      mode: null,
      readable: 'unknown',
      writable: readonly === null ? 'unknown' : !readonly,
      executable: 'unknown',
      readonly,
      semantic: readonly === null ? 'unknown' : (readonly ? 'read-only' : 'writable'),
    });
  }
  return Object.freeze({
    mode,
    readable: deriveTriState(mode, 6),
    writable: deriveTriState(mode, 3),
    executable: deriveTriState(mode, 0),
    readonly: null,
    semantic: mode === null ? 'unknown' : 'posix-mode',
  });
}

function normalizeAcl(raw, platform) {
  if (raw.acl !== undefined && !Array.isArray(raw.acl)) {
    throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'acl must be an array when supplied');
  }
  if (Array.isArray(raw.acl)) {
    if (raw.acl.length > MAX_ACL_ENTRIES) throw new PermissionOwnershipError('LIMIT_EXCEEDED', 'acl entry count exceeds limit');
    return 'available';
  }
  if (raw.aclState !== undefined) {
    if (!['available', 'unsupported', 'unavailable', 'not-requested'].includes(raw.aclState)) {
      throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'invalid aclState');
    }
    return raw.aclState;
  }
  if (raw.aclUnsupported === true) return 'unsupported';
  if (raw.aclUnavailable === true) return 'unavailable';
  return platform === 'windows' || platform === 'linux' || platform === 'macos' || platform === 'wsl' ? 'not-requested' : 'unsupported';
}

function normalizeFlags(raw) {
  if (raw.flags === undefined || raw.flags === null) return Object.freeze([]);
  if (!Array.isArray(raw.flags)) throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'flags must be an array');
  if (raw.flags.length > MAX_FLAGS) throw new PermissionOwnershipError('LIMIT_EXCEEDED', 'flag count exceeds limit');
  const values = raw.flags.map((flag) => {
    if (typeof flag !== 'string' || flag.length > MAX_FLAG_LENGTH) {
      throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'flags must be bounded strings');
    }
    return flag;
  });
  return Object.freeze([...new Set(values)].sort());
}

function deriveCapabilities(platform, raw, acl) {
  const hasMode = raw.mode !== null && raw.mode !== undefined;
  const hasOwnerId = raw.uid !== undefined || raw.gid !== undefined;
  const hasOwnerName = raw.username !== undefined || raw.groupname !== undefined;
  return {
    modeBits: hasMode && platform !== 'windows',
    numericOwnerIds: hasOwnerId,
    ownerNames: hasOwnerName,
    writable: platform === 'windows' ? raw.readonly !== undefined : hasMode,
    nativeAcl: acl === 'available',
    flags: Array.isArray(raw.flags),
  };
}

function normalizeDescriptor(raw, options = {}, seams = {}) {
  assertPlainOptions(options);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PermissionOwnershipError('INVALID_STAT', 'raw metadata must be an object');
  }
  rejectAccessors(raw);
  const hash = typeof seams.hash === 'function' ? seams.hash : hashText;
  const platform = normalizePlatform(seams.platform ?? raw.platform);
  if (!PLATFORM_NAMES.has(platform)) throw new PermissionOwnershipError('PLATFORM_MISMATCH', 'unsupported platform identity');
  const mode = normalizeMode(platform === 'windows' ? null : raw.mode);
  if (platform !== 'windows' && raw.mode !== undefined && raw.mode !== null && mode === null) {
    throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'mode is unavailable or malformed');
  }
  const readonly = raw.readonly === undefined || raw.readonly === null ? null : (typeof raw.readonly === 'boolean' ? raw.readonly : (() => { throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'readonly must be boolean or null'); })());
  const acl = normalizeAcl(raw, platform);
  const flags = normalizeFlags(raw);
  const descriptor = {
    format: FORMAT,
    version: VERSION,
    path: normalizePath(raw.path ?? ''),
    platform,
    nodeType: raw.kind ?? 'other',
    mode,
    readable: normalizePermissions(platform, mode, readonly).readable,
    writable: normalizePermissions(platform, mode, readonly).writable,
    executable: normalizePermissions(platform, mode, readonly).executable,
    permission: normalizePermissions(platform, mode, readonly),
    owner: normalizeOwner(raw, options, 'owner', hash),
    group: normalizeOwner(raw, options, 'group', hash),
    acl,
    flags,
    capabilities: deriveCapabilities(platform, { ...raw, mode }, acl),
    observedAt: seams.clock === undefined ? null : (typeof seams.clock === 'function' ? seams.clock() : (() => { throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'clock capability must be callable'); })()),
    source: {
      kind: raw.kind ?? 'other',
      path: normalizePath(raw.path ?? ''),
      link: raw.link === true,
    },
  };
  if (descriptor.observedAt !== null && (typeof descriptor.observedAt !== 'string' || descriptor.observedAt.length > 128)) {
    throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'clock capability returned an invalid timestamp');
  }
  return freezeDeep(descriptor);
}

export function normalizeDescriptor(raw, options = {}) {
  return normalizeDescriptorInternal(raw, options, {});
}

function normalizeDescriptorInternal(raw, options, seams) {
  return normalizeDescriptor(raw, options, seams);
}

export async function inspectPath(path, capabilities, options = {}) {
  assertPlainOptions(options);
  let requestedPath = normalizePath(path);
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    throw new PermissionOwnershipError('INVALID_CAPABILITY', 'capabilities required');
  }
  rejectAccessors(capabilities);
  if (typeof capabilities.lstat !== 'function') throw new PermissionOwnershipError('INVALID_CAPABILITY', 'lstat capability required');
  if (typeof capabilities.cancelled === 'function' && capabilities.cancelled()) {
    throw new PermissionOwnershipError('CANCELLED', 'inspection cancelled');
  }
  if (!isAbsolutePath(requestedPath)) {
    if (typeof capabilities.resolvePath !== 'function') throw new PermissionOwnershipError('PATH_ROOT_ESCAPE', 'relative path requires an explicit root-resolution capability');
    const resolved = capabilities.resolvePath(requestedPath);
    if (typeof resolved !== 'string' || !isAbsolutePath(resolved)) throw new PermissionOwnershipError('PATH_ROOT_ESCAPE', 'root resolution did not produce an absolute path');
    requestedPath = normalizePath(resolved);
  }
  if (typeof capabilities.validatePath === 'function') {
    const valid = capabilities.validatePath(requestedPath);
    if (valid !== true) throw new PermissionOwnershipError('PATH_ROOT_ESCAPE', 'path containment validation failed');
  }
  const platform = capabilities.platform === undefined ? undefined : (typeof capabilities.platform === 'function' ? capabilities.platform() : (() => { throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'platform capability must be callable'); })());
  if (platform !== undefined && typeof platform !== 'string') throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'platform capability returned a non-string');
  const raw = await capabilities.lstat(requestedPath);
  if (typeof capabilities.cancelled === 'function' && capabilities.cancelled()) {
    throw new PermissionOwnershipError('CANCELLED', 'inspection cancelled');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'lstat returned malformed metadata');
  rejectAccessors(raw);
  const rawPlatform = raw.platform === undefined ? undefined : normalizePlatform(raw.platform);
  const observedPlatform = platform === undefined ? rawPlatform : normalizePlatform(platform);
  if (rawPlatform !== undefined && platform !== undefined && rawPlatform !== observedPlatform) {
    throw new PermissionOwnershipError('PLATFORM_MISMATCH', 'capability platform does not match metadata platform');
  }
  const merged = { ...raw, path: requestedPath, platform: observedPlatform ?? 'other' };
  return normalizeDescriptorInternal(merged, options, {
    platform: observedPlatform,
    clock: capabilities.clock,
    hash: capabilities.hash,
  });
}

export function createNodeCapabilities({ lstat, platform, clock, hash, resolvePath, validatePath, cancelled }) {
  if (typeof lstat !== 'function') throw new PermissionOwnershipError('INVALID_CAPABILITY', 'lstat function required');
  for (const [name, value] of Object.entries({ platform, clock, hash, resolvePath, validatePath, cancelled })) {
    if (value !== undefined && typeof value !== 'function') throw new PermissionOwnershipError('INVALID_CAPABILITY', `${name} capability must be callable`);
  }
  return Object.freeze({ lstat, platform, clock, hash, resolvePath, validatePath, cancelled });
}

export function serializeDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') throw new PermissionOwnershipError('INVALID_DESCRIPTOR', 'descriptor required');
  rejectAccessors(descriptor);
  const payload = { format: FORMAT, version: VERSION, descriptor: stable(descriptor) };
  const body = canonicalJson(payload);
  if (Buffer.byteLength(body, 'utf8') > MAX_SERIALIZED_BYTES) throw new PermissionOwnershipError('LIMIT_EXCEEDED', 'serialized descriptor exceeds limit');
  const checksum = hashText(body);
  return `${FORMAT}|${VERSION}|${body}|${checksum}`;
}

export function parseDescriptor(serialized) {
  if (typeof serialized !== 'string') throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'serialized descriptor must be string');
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED_BYTES + 128) throw new PermissionOwnershipError('LIMIT_EXCEEDED', 'serialized descriptor exceeds limit');
  const first = serialized.indexOf('|');
  const second = serialized.indexOf('|', first + 1);
  const last = serialized.lastIndexOf('|');
  if (first < 0 || second < 0 || last <= second) throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'invalid serialization envelope');
  const format = serialized.slice(0, first);
  const versionText = serialized.slice(first + 1, second);
  const body = serialized.slice(second + 1, last);
  const checksum = serialized.slice(last + 1);
  if (format !== FORMAT || versionText !== String(VERSION) || !/^[0-9a-f]{64}$/.test(checksum)) throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'invalid serialization header');
  const expected = hashText(body);
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(checksum, 'utf8');
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new PermissionOwnershipError('INTEGRITY_FAILURE', 'descriptor integrity check failed');
  let parsed;
  try { parsed = JSON.parse(body); } catch { throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'invalid descriptor payload'); }
  if (!parsed || parsed.format !== FORMAT || parsed.version !== VERSION || !parsed.descriptor) throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'invalid descriptor payload');
  rejectAccessors(parsed);
  return freezeDeep(parsed.descriptor);
}

export { PermissionOwnershipError, FORMAT, VERSION, MAX_SERIALIZED_BYTES };
