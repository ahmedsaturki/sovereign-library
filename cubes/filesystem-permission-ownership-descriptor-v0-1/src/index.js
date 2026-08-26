import { createHash, timingSafeEqual } from 'node:crypto';

const FORMAT = 'PPO1';
const VERSION = 1;
const MAX_PATH_LENGTH = 4096;
const MAX_IDENTIFIER_LENGTH = 512;
const MAX_FLAGS = 64;
const MAX_FLAG_LENGTH = 128;
const MAX_ACL_ENTRIES = 256;
const MAX_SERIALIZED_BYTES = 32768;
const PLATFORMS = new Set(['windows', 'linux', 'macos', 'wsl', 'other']);
const ACL_STATES = new Set(['available', 'unsupported', 'unavailable', 'not-requested']);

export class PermissionOwnershipError extends Error {
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
    const d = Object.getOwnPropertyDescriptor(value, key);
    const label = typeof key === 'symbol' ? key.toString() : key;
    if (d?.get || d?.set) throw new PermissionOwnershipError('ACCESSOR_INPUT', `Accessor input rejected at ${path}.${label}`);
    if ('value' in d) rejectAccessors(d.value, `${path}.${label}`, seen);
  }
  seen.delete(value);
}

function assertOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new PermissionOwnershipError('INVALID_OPTIONS', 'Options must be an object');
  rejectAccessors(options);
  for (const k of ['includeOwnerName', 'includeGroupName', 'includeOwnerId', 'includeGroupId']) {
    if (options[k] !== undefined && typeof options[k] !== 'boolean') throw new PermissionOwnershipError('INVALID_OPTIONS', `${k} must be boolean`);
  }
  if (options.ownerRedaction !== undefined && !['none', 'hash'].includes(options.ownerRedaction)) throw new PermissionOwnershipError('INVALID_OPTIONS', 'ownerRedaction must be none or hash');
}

function normalizePlatform(value) {
  const p = String(value ?? '').toLowerCase();
  if (p === 'win32' || p === 'windows') return 'windows';
  if (p === 'darwin' || p === 'mac' || p === 'macos') return 'macos';
  if (p === 'linux') return 'linux';
  if (p === 'wsl') return 'wsl';
  return 'other';
}

function normalizePath(path) {
  if (typeof path !== 'string' || path.length === 0) throw new PermissionOwnershipError('INVALID_PATH', 'path must be a non-empty string');
  if (path.length > MAX_PATH_LENGTH) throw new PermissionOwnershipError('LIMIT_EXCEEDED', 'path exceeds the maximum length');
  return path;
}

function absolute(path) { return path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path); }
function hashText(value) { return createHash('sha256').update(String(value), 'utf8').digest('hex'); }

function freezeDeep(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (seen.has(value)) throw new PermissionOwnershipError('CIRCULAR_INPUT', 'Circular value rejected');
  seen.add(value);
  for (const child of Object.values(value)) freezeDeep(child, seen);
  seen.delete(value);
  return Object.freeze(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])]));
}

function canonical(value) { return JSON.stringify(stable(value)); }

function normalizeMode(value, platform) {
  if (platform === 'windows' || value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 0 || value > 0o7777) throw new PermissionOwnershipError('INVALID_STAT', 'mode must be a valid POSIX mode integer');
  return value;
}

function normalizeId(value, field, exposed) {
  if (value === null || value === undefined) return null;
  if (!(typeof value === 'string' || Number.isSafeInteger(value))) throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', `${field} must be a bounded string or safe integer`);
  if (String(value).length > MAX_IDENTIFIER_LENGTH) throw new PermissionOwnershipError('LIMIT_EXCEEDED', `${field} exceeds the maximum length`);
  return exposed ? value : null;
}

function normalizeIdentity(raw, kind, options, hash) {
  const idKey = kind === 'owner' ? 'uid' : 'gid';
  const nameKey = kind === 'owner' ? 'username' : 'groupname';
  const includeId = kind === 'owner' ? options.includeOwnerId : options.includeGroupId;
  const includeName = kind === 'owner' ? options.includeOwnerName : options.includeGroupName;
  const idPresent = raw[idKey] !== undefined && raw[idKey] !== null;
  const namePresent = raw[nameKey] !== undefined && raw[nameKey] !== null;
  const id = normalizeId(raw[idKey], idKey, includeId);
  let name = null;
  if (namePresent) {
    if (typeof raw[nameKey] !== 'string') throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', `${nameKey} must be a string or null`);
    if (raw[nameKey].length > MAX_IDENTIFIER_LENGTH) throw new PermissionOwnershipError('LIMIT_EXCEEDED', `${nameKey} exceeds the maximum length`);
    if (includeName) name = options.ownerRedaction === 'none' ? raw[nameKey] : `sha256:${hash(raw[nameKey])}`;
  }
  const present = idPresent || namePresent;
  return Object.freeze({ state: !present ? 'unknown' : (includeId || includeName ? 'known' : 'redacted'), id, name });
}

function tri(mode, mask) { return mode === null ? 'unknown' : (mode & mask) !== 0; }

function normalizePermissions(platform, mode, readonly) {
  if (platform === 'windows') return Object.freeze({ mode: null, readable: 'unknown', writable: readonly === null ? 'unknown' : !readonly, executable: 'unknown', readonly, semantic: readonly === null ? 'unknown' : (readonly ? 'read-only' : 'writable') });
  return Object.freeze({ mode, readable: tri(mode, 0o444), writable: tri(mode, 0o222), executable: tri(mode, 0o111), readonly: null, semantic: mode === null ? 'unknown' : 'posix-mode' });
}

function normalizeAcl(raw, platform) {
  if (raw.acl !== undefined && !Array.isArray(raw.acl)) throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'acl must be an array when supplied');
  if (Array.isArray(raw.acl)) {
    if (raw.acl.length > MAX_ACL_ENTRIES) throw new PermissionOwnershipError('LIMIT_EXCEEDED', 'acl entry count exceeds limit');
    return 'available';
  }
  if (raw.aclState !== undefined) {
    if (!ACL_STATES.has(raw.aclState)) throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'invalid aclState');
    return raw.aclState;
  }
  if (raw.aclUnsupported === true) return 'unsupported';
  if (raw.aclUnavailable === true) return 'unavailable';
  return platform === 'other' ? 'unsupported' : 'not-requested';
}

function normalizeFlags(raw) {
  if (raw.flags === undefined || raw.flags === null) return Object.freeze([]);
  if (!Array.isArray(raw.flags)) throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'flags must be an array');
  if (raw.flags.length > MAX_FLAGS) throw new PermissionOwnershipError('LIMIT_EXCEEDED', 'flag count exceeds limit');
  const flags = raw.flags.map((f) => {
    if (typeof f !== 'string' || f.length > MAX_FLAG_LENGTH) throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'flags must be bounded strings');
    return f;
  });
  return Object.freeze([...new Set(flags)].sort());
}

function buildDescriptor(raw, options, seams = {}) {
  assertOptions(options);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PermissionOwnershipError('INVALID_STAT', 'raw metadata must be an object');
  rejectAccessors(raw);
  const platform = normalizePlatform(seams.platform ?? raw.platform);
  if (!PLATFORMS.has(platform)) throw new PermissionOwnershipError('PLATFORM_MISMATCH', 'unsupported platform identity');
  const mode = normalizeMode(raw.mode, platform);
  const readonly = raw.readonly === undefined || raw.readonly === null ? null : raw.readonly;
  if (typeof readonly !== 'boolean' && readonly !== null) throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'readonly must be boolean or null');
  const permissions = normalizePermissions(platform, mode, readonly);
  const acl = normalizeAcl(raw, platform);
  const flags = normalizeFlags(raw);
  const hash = typeof seams.hash === 'function' ? seams.hash : hashText;
  const observedAt = seams.clock === undefined ? null : seams.clock();
  if (observedAt !== null && (typeof observedAt !== 'string' || observedAt.length > 128)) throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'clock capability returned an invalid timestamp');
  const path = normalizePath(raw.path ?? '');
  const descriptor = {
    format: FORMAT,
    version: VERSION,
    path,
    platform,
    nodeType: raw.kind ?? 'other',
    mode,
    readable: permissions.readable,
    writable: permissions.writable,
    executable: permissions.executable,
    owner: normalizeIdentity(raw, 'owner', options, hash),
    group: normalizeIdentity(raw, 'group', options, hash),
    acl,
    flags,
    capabilities: Object.freeze({
      modeBits: mode !== null,
      numericOwnerIds: raw.uid !== undefined || raw.gid !== undefined,
      ownerNames: raw.username !== undefined || raw.groupname !== undefined,
      writable: platform === 'windows' ? raw.readonly !== undefined : mode !== null,
      nativeAcl: acl === 'available',
      flags: raw.flags !== undefined,
    }),
    permission: permissions,
    observedAt,
    source: Object.freeze({ kind: raw.kind ?? 'other', path, link: raw.link === true }),
  };
  return freezeDeep(descriptor);
}

export function normalizeDescriptor(raw, options = {}) { return buildDescriptor(raw, options); }

export async function inspectPath(path, capabilities, options = {}) {
  assertOptions(options);
  let target = normalizePath(path);
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) throw new PermissionOwnershipError('INVALID_CAPABILITY', 'capabilities required');
  rejectAccessors(capabilities);
  if (typeof capabilities.lstat !== 'function') throw new PermissionOwnershipError('INVALID_CAPABILITY', 'lstat capability required');
  if (typeof capabilities.cancelled === 'function' && capabilities.cancelled()) throw new PermissionOwnershipError('CANCELLED', 'inspection cancelled');
  if (!absolute(target)) {
    if (typeof capabilities.resolvePath !== 'function') throw new PermissionOwnershipError('PATH_ROOT_ESCAPE', 'relative path requires an explicit root-resolution capability');
    target = normalizePath(capabilities.resolvePath(target));
    if (!absolute(target)) throw new PermissionOwnershipError('PATH_ROOT_ESCAPE', 'root resolution did not produce an absolute path');
  }
  if (typeof capabilities.validatePath === 'function' && capabilities.validatePath(target) !== true) throw new PermissionOwnershipError('PATH_ROOT_ESCAPE', 'path containment validation failed');
  const suppliedPlatform = capabilities.platform === undefined ? undefined : capabilities.platform();
  if (suppliedPlatform !== undefined && typeof suppliedPlatform !== 'string') throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'platform capability must return a string');
  const raw = await capabilities.lstat(target);
  if (typeof capabilities.cancelled === 'function' && capabilities.cancelled()) throw new PermissionOwnershipError('CANCELLED', 'inspection cancelled');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PermissionOwnershipError('MALFORMED_CAPABILITY_RESULT', 'lstat returned malformed metadata');
  rejectAccessors(raw);
  const capabilityPlatform = suppliedPlatform === undefined ? undefined : normalizePlatform(suppliedPlatform);
  const metadataPlatform = raw.platform === undefined ? undefined : normalizePlatform(raw.platform);
  if (capabilityPlatform !== undefined && metadataPlatform !== undefined && capabilityPlatform !== metadataPlatform) throw new PermissionOwnershipError('PLATFORM_MISMATCH', 'capability platform does not match metadata platform');
  return buildDescriptor({ ...raw, path: target, platform: capabilityPlatform ?? metadataPlatform ?? 'other' }, options, { platform: capabilityPlatform ?? metadataPlatform ?? 'other', clock: capabilities.clock, hash: capabilities.hash });
}

export function createNodeCapabilities({ lstat, platform, clock, hash, resolvePath, validatePath, cancelled }) {
  if (typeof lstat !== 'function') throw new PermissionOwnershipError('INVALID_CAPABILITY', 'lstat function required');
  for (const [name, fn] of Object.entries({ platform, clock, hash, resolvePath, validatePath, cancelled })) {
    if (fn !== undefined && typeof fn !== 'function') throw new PermissionOwnershipError('INVALID_CAPABILITY', `${name} capability must be callable`);
  }
  return Object.freeze({ lstat, platform, clock, hash, resolvePath, validatePath, cancelled });
}

export function serializeDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') throw new PermissionOwnershipError('INVALID_DESCRIPTOR', 'descriptor required');
  rejectAccessors(descriptor);
  const body = canonical({ format: FORMAT, version: VERSION, descriptor });
  if (Buffer.byteLength(body, 'utf8') > MAX_SERIALIZED_BYTES) throw new PermissionOwnershipError('LIMIT_EXCEEDED', 'serialized descriptor exceeds limit');
  return `${FORMAT}|${VERSION}|${body}|${hashText(body)}`;
}

export function parseDescriptor(serialized) {
  if (typeof serialized !== 'string') throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'serialized descriptor must be string');
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED_BYTES + 128) throw new PermissionOwnershipError('LIMIT_EXCEEDED', 'serialized descriptor exceeds limit');
  const first = serialized.indexOf('|');
  const second = serialized.indexOf('|', first + 1);
  const last = serialized.lastIndexOf('|');
  if (first < 0 || second < 0 || last <= second) throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'invalid serialization envelope');
  const format = serialized.slice(0, first);
  const version = serialized.slice(first + 1, second);
  const body = serialized.slice(second + 1, last);
  const checksum = serialized.slice(last + 1);
  if (format !== FORMAT || version !== String(VERSION) || !/^[0-9a-f]{64}$/.test(checksum)) throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'invalid serialization header');
  const expected = Buffer.from(hashText(body));
  const actual = Buffer.from(checksum);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new PermissionOwnershipError('INTEGRITY_FAILURE', 'descriptor integrity check failed');
  let parsed;
  try { parsed = JSON.parse(body); } catch { throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'invalid descriptor payload'); }
  if (!parsed || parsed.format !== FORMAT || parsed.version !== VERSION || !parsed.descriptor) throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'invalid descriptor payload');
  rejectAccessors(parsed);
  return freezeDeep(parsed.descriptor);
}

export { FORMAT, VERSION, MAX_SERIALIZED_BYTES };
