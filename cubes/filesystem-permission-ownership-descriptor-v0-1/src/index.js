import { createHash, timingSafeEqual } from 'node:crypto';

const FORMAT = 'PPO1';
const VERSION = 1;
const MAX_SERIALIZED_BYTES = 32768;

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
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.get || descriptor?.set) {
      throw new PermissionOwnershipError('ACCESSOR_INPUT', `Accessor input rejected at ${path}.${key}`);
    }
    rejectAccessors(value[key], `${path}.${key}`, seen);
  }
  seen.delete(value);
}

function assertPlainOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new PermissionOwnershipError('INVALID_OPTIONS', 'Options must be an object');
  }
  rejectAccessors(options);
  if (options.includeOwnerName !== undefined && typeof options.includeOwnerName !== 'boolean') {
    throw new PermissionOwnershipError('INVALID_OPTIONS', 'includeOwnerName must be boolean');
  }
  if (options.includeGroupName !== undefined && typeof options.includeGroupName !== 'boolean') {
    throw new PermissionOwnershipError('INVALID_OPTIONS', 'includeGroupName must be boolean');
  }
  if (options.ownerRedaction !== undefined && !['none', 'hash'].includes(options.ownerRedaction)) {
    throw new PermissionOwnershipError('INVALID_OPTIONS', 'ownerRedaction must be none or hash');
  }
}

function hashText(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
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
  if (value === 'win32') return 'windows';
  if (value === 'darwin') return 'macos';
  if (value === 'linux') return 'linux';
  if (value.includes('wsl')) return 'wsl';
  return 'other';
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

function normalizeOwner(raw, options, kind) {
  const idField = kind === 'owner' ? 'uid' : 'gid';
  const nameField = kind === 'owner' ? 'username' : 'groupname';
  const id = normalizeSafeInteger(raw?.[idField], idField);
  let name = raw?.[nameField] ?? null;
  if (name !== null && typeof name !== 'string') throw new PermissionOwnershipError('INVALID_STAT', `${nameField} must be string or null`);
  if (name !== null && name.length > 512) throw new PermissionOwnershipError('LIMIT_EXCEEDED', `${nameField} exceeds 512 characters`);
  const includeName = kind === 'owner' ? options.includeOwnerName : options.includeGroupName;
  const redaction = options.ownerRedaction ?? 'hash';
  if (!includeName || name === null) name = null;
  else if (redaction === 'hash') name = `sha256:${hashText(name)}`;
  return Object.freeze({ id, name });
}

function deriveCapabilities(platform, raw) {
  const hasMode = raw.mode !== null && raw.mode !== undefined;
  return {
    modeBits: hasMode,
    numericOwnerIds: raw.uid !== undefined || raw.gid !== undefined,
    ownerNames: raw.username !== undefined || raw.groupname !== undefined,
    writable: platform === 'windows' ? raw.readonly !== undefined : hasMode,
    nativeAcl: platform === 'windows' && Array.isArray(raw.acl),
  };
}

export function normalizeDescriptor(raw, options = {}) {
  assertPlainOptions(options);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PermissionOwnershipError('INVALID_STAT', 'raw metadata must be an object');
  }
  rejectAccessors(raw);
  const platform = normalizePlatform(raw.platform);
  const mode = normalizeMode(raw.mode);
  const uid = normalizeSafeInteger(raw.uid, 'uid');
  const gid = normalizeSafeInteger(raw.gid, 'gid');
  const readonly = raw.readonly === undefined ? null : Boolean(raw.readonly);
  const descriptor = {
    format: FORMAT,
    version: VERSION,
    platform,
    capability: deriveCapabilities(platform, { ...raw, mode, uid, gid }),
    permission: {
      mode,
      readonly,
      semantic: platform === 'windows' ? (readonly === null ? 'unknown' : (readonly ? 'read-only' : 'writable')) : 'posix-mode',
    },
    ownership: {
      owner: normalizeOwner(raw, options, 'owner'),
      group: normalizeOwner(raw, options, 'group'),
    },
    source: {
      kind: raw.kind ?? 'unknown',
      path: typeof raw.path === 'string' ? raw.path : null,
      link: raw.link === true,
    },
  };
  return freezeDeep(descriptor);
}

export async function inspectPath(path, capabilities, options = {}) {
  assertPlainOptions(options);
  if (typeof path !== 'string' || path.length === 0) throw new PermissionOwnershipError('INVALID_PATH', 'path must be a non-empty string');
  if (!capabilities || typeof capabilities !== 'object') throw new PermissionOwnershipError('INVALID_CAPABILITY', 'capabilities required');
  const required = ['lstat'];
  for (const name of required) if (typeof capabilities[name] !== 'function') throw new PermissionOwnershipError('INVALID_CAPABILITY', `${name} capability required`);
  const raw = await capabilities.lstat(path);
  if (!raw || typeof raw !== 'object') throw new PermissionOwnershipError('INVALID_STAT', 'lstat returned malformed metadata');
  const merged = { ...raw, path };
  return normalizeDescriptor(merged, options);
}

export function createNodeCapabilities({ lstat }) {
  if (typeof lstat !== 'function') throw new PermissionOwnershipError('INVALID_CAPABILITY', 'lstat function required');
  return { lstat };
}

export function serializeDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') throw new PermissionOwnershipError('INVALID_DESCRIPTOR', 'descriptor required');
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
  const version = Number(serialized.slice(first + 1, second));
  const body = serialized.slice(second + 1, last);
  const checksum = serialized.slice(last + 1);
  if (format !== FORMAT || version !== VERSION || !/^[0-9a-f]{64}$/.test(checksum)) {
    throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'invalid serialization header');
  }
  const expected = hashText(body);
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(checksum))) throw new PermissionOwnershipError('INTEGRITY_FAILURE', 'descriptor integrity check failed');
  let parsed;
  try { parsed = JSON.parse(body); } catch { throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'invalid descriptor payload'); }
  if (parsed.format !== FORMAT || parsed.version !== VERSION || !parsed.descriptor) throw new PermissionOwnershipError('MALFORMED_SERIALIZATION', 'invalid descriptor payload');
  return freezeDeep(parsed.descriptor);
}

export { PermissionOwnershipError, FORMAT, VERSION, MAX_SERIALIZED_BYTES };
