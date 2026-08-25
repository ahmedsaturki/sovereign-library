import { createHash } from 'node:crypto';
import * as os from 'node:os';
import process from 'node:process';

const FORMAT = 'HIF1';
const MAX_STABLE_FIELDS = 32;
const MAX_VOLATILE_FIELDS = 16;
const MAX_FIELD_NAME = 128;
const MAX_FIELD_VALUE = 2048;
const MAX_ENV_FIELDS = 32;
const MAX_ENV_AGGREGATE = 16 * 1024;
const MAX_SERIALIZED = 64 * 1024;
const MAX_DIFFS = 64;
const STATUS = new Set(['available', 'unavailable', 'unsupported', 'permission_denied']);
const OS_FAMILIES = new Set(['linux', 'darwin', 'win32', 'freebsd', 'openbsd', 'sunos', 'aix', 'android', 'other']);
const ARCHITECTURES = new Set(['x64', 'arm64', 'arm', 'ia32', 'ppc64', 'ppc64le', 's390x', 'riscv64', 'loong64', 'other']);
const SENSITIVE = /(pass(word)?|secret|token|private[._-]?key|credential|authorization|cookie|api[._-]?key|access[._-]?key|session[._-]?key|auth)/i;

export class HostIdentityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HostIdentityError';
    this.code = code;
    Object.freeze(this);
  }
}

const fail = (code, message) => { throw new HostIdentityError(code, message); };
const plain = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

function validatePlain(value, label, seen = new Set(), depth = 0) {
  if (depth > 12) fail('DEPTH_LIMIT', `${label} exceeds maximum depth`);
  if (value === null) return;
  const type = typeof value;
  if (['function', 'symbol', 'bigint', 'undefined'].includes(type)) fail('UNSUPPORTED_VALUE', `${label} contains unsupported value`);
  if (type === 'number' && !Number.isFinite(value)) fail('UNSUPPORTED_VALUE', `${label} contains a non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  if (!Array.isArray(value) && !plain(value)) fail('UNSUPPORTED_VALUE', `${label} must contain plain data`);
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail('UNSUPPORTED_VALUE', `${label} contains symbol keys`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    validatePlain(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function validateTopOptions(options) {
  if (!plain(options)) fail('INVALID_OPTIONS', 'options must be a plain object');
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string') fail('UNSUPPORTED_VALUE', 'options contains symbol keys');
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `options.${key} is accessor-backed`);
  }
}

function readData(object, key, label) {
  if (!object) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
  return descriptor.value;
}

function validateCapabilityContainer(value, label) {
  if (!plain(value)) fail('INVALID_CAPABILITY', `${label} must be a plain capability object`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    const item = descriptor.value;
    if (typeof item === 'function') continue;
    validatePlain(item, `${label}.${key}`);
  }
}

function getCap(container, key, label) {
  const value = readData(container, key, label);
  if (value === undefined) return undefined;
  if (typeof value === 'function') return value;
  return () => value;
}

function boundedString(value, label, max = MAX_FIELD_VALUE) {
  if (typeof value !== 'string' || value.length === 0) fail('INVALID_FIELD', `${label} must be a non-empty string`);
  if (value.length > max) fail('FIELD_TOO_LARGE', `${label} exceeds ${max} characters`);
  return value;
}

function availability(value, label) {
  if (typeof value === 'string') return { status: 'available', value: boundedString(value, label) };
  if (!plain(value)) fail('INVALID_CAPABILITY_RESULT', `${label} must return a string or availability object`);
  const status = readData(value, 'status', label);
  if (typeof status !== 'string' || !STATUS.has(status)) fail('INVALID_CAPABILITY_RESULT', `${label}.status is invalid`);
  if (status !== 'available') return { status };
  const data = readData(value, 'value', label);
  return { status, value: normalizeScalar(data, `${label}.value`) };
}

function normalizeScalar(value, label) {
  if (typeof value === 'string') return boundedString(value, label);
  if (typeof value === 'boolean') return value;
  if (Number.isSafeInteger(value)) return value;
  fail('INVALID_CAPABILITY_RESULT', `${label} has an unsupported value`);
}

async function callCapability(fn, label) {
  try {
    return await fn();
  } catch (error) {
    if (error?.code === 'UNSUPPORTED') return { status: 'unsupported' };
    if (error?.code === 'UNAVAILABLE') return { status: 'unavailable' };
    if (['EACCES', 'EPERM', 'PERMISSION_DENIED'].includes(error?.code)) return { status: 'permission_denied' };
    fail('CAPABILITY_FAILURE', `${label} failed`);
  }
}

function canonicalize(value) {
  validatePlain(value, 'value');
  return JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
    : item);
}

function canonicalHash(serialized) {
  return `sha256:${createHash('sha256').update(serialized, 'utf8').digest('hex')}`;
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function normalizeOs(value) { return OS_FAMILIES.has(String(value)) ? String(value) : 'other'; }
function normalizeArch(value) { return ARCHITECTURES.has(String(value)) ? String(value) : 'other'; }
function normalizeSeparator(value) {
  if (value === '/' || value === '\\') return value;
  fail('INVALID_CAPABILITY_RESULT', 'path separator must be / or \\');
}
function normalizeCase(value) {
  if (['sensitive', 'insensitive'].includes(value)) return { status: 'available', value };
  if (['unavailable', 'unsupported', 'permission_denied'].includes(value)) return { status: value };
  fail('INVALID_CAPABILITY_RESULT', 'caseSensitivity is invalid');
}
function runtimeMajor(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  if (!match) fail('INVALID_CAPABILITY_RESULT', 'runtime version is malformed');
  return Number(match[1]);
}
function envKeyAllowed(key) {
  return !SENSITIVE.test(key);
}
function normalizeEnvironment(environment) {
  if (!plain(environment)) fail('INVALID_ENVIRONMENT', 'environment must be a plain object');
  const allowlist = readData(environment, 'allowlist', 'environment') ?? [];
  if (!Array.isArray(allowlist) || allowlist.length > MAX_ENV_FIELDS) fail('LIMIT_EXCEEDED', `environment.allowlist exceeds ${MAX_ENV_FIELDS} entries`);
  const values = readData(environment, 'values', 'environment') ?? {};
  if (!plain(values)) fail('INVALID_ENVIRONMENT', 'environment.values must be a plain object');
  const keys = [...new Set(allowlist)].sort();
  if (keys.length !== allowlist.length) fail('DUPLICATE_ENV_FIELD', 'environment.allowlist contains duplicates');
  const result = {};
  let total = 0;
  for (const key of keys) {
    boundedString(key, `environment.allowlist.${key}`, MAX_FIELD_NAME);
    if (!envKeyAllowed(key)) fail('DISALLOWED_SENSITIVE_FIELD', `${key} is sensitive`);
    if (!(key in values)) continue;
    const value = readData(values, key, `environment.values`);
    boundedString(value, `environment.${key}`);
    total += key.length + value.length;
    if (total > MAX_ENV_AGGREGATE) fail('LIMIT_EXCEEDED', `environment fields exceed ${MAX_ENV_AGGREGATE} bytes`);
    result[key] = { status: 'available', value };
  }
  return result;
}

function stableIdentityPayload(stable) { return canonicalize(stable); }

function validateFingerprint(fingerprint) {
  try {
    validatePlain(fingerprint, 'fingerprint');
    if (!plain(fingerprint) || fingerprint.format !== FORMAT || !plain(fingerprint.stable) || !plain(fingerprint.volatile)) return false;
    if (!/^sha256:[0-9a-f]{64}$/.test(fingerprint.identity)) return false;
    if (typeof fingerprint.serialization !== 'string' || Buffer.byteLength(fingerprint.serialization, 'utf8') > MAX_SERIALIZED) return false;
    if (stableIdentityPayload(fingerprint.stable) !== fingerprint.serialization) return false;
    return canonicalHash(fingerprint.serialization) === fingerprint.identity;
  } catch {
    return false;
  }
}

function diffValues(left, right, section, path = '', out = []) {
  if (out.length >= MAX_DIFFS) return out;
  const keys = [...new Set([...(plain(left) ? Object.keys(left) : []), ...(plain(right) ? Object.keys(right) : [])])].sort();
  for (const key of keys) {
    if (out.length >= MAX_DIFFS) break;
    const next = path ? `${path}.${key}` : key;
    const a = left?.[key];
    const b = right?.[key];
    if (plain(a) && plain(b)) diffValues(a, b, section, next, out);
    else if (canonicalize(a) !== canonicalize(b)) out.push({ section, path: next, left: a, right: b });
  }
  return out;
}

export async function fingerprintHost(options = {}) {
  validateTopOptions(options);
  const platform = readData(options, 'platform', 'options') ?? {};
  const runtime = readData(options, 'runtime', 'options') ?? {};
  const path = readData(options, 'path', 'options') ?? {};
  const environment = readData(options, 'environment', 'options') ?? {};
  const clockContainer = readData(options, 'clock', 'options') ?? {};
  const serializer = readData(options, 'serialize', 'options') ?? canonicalize;
  const hash = readData(options, 'hash', 'options') ?? canonicalHash;
  validateCapabilityContainer(platform, 'options.platform');
  validateCapabilityContainer(runtime, 'options.runtime');
  validateCapabilityContainer(path, 'options.path');
  validateCapabilityContainer(environment, 'options.environment');
  validateCapabilityContainer(clockContainer, 'options.clock');
  if (typeof serializer !== 'function' || typeof hash !== 'function') fail('INVALID_CAPABILITY', 'serialize and hash must be functions');
  const platformFn = getCap(platform, 'platform', 'platform') ?? (() => process.platform);
  const architectureFn = getCap(platform, 'architecture', 'platform') ?? (() => process.arch);
  const releaseFn = getCap(platform, 'release', 'platform') ?? (() => ({ status: 'available', value: os.release() }));
  const familyFn = getCap(runtime, 'family', 'runtime') ?? (() => 'node');
  const versionFn = getCap(runtime, 'version', 'runtime') ?? (() => process.version);
  const separatorFn = getCap(path, 'separator', 'path') ?? (() => process.platform === 'win32' ? '\\' : '/');
  const caseFn = getCap(path, 'caseSensitivity', 'path') ?? (() => ({ status: 'unavailable' }));
  const clockFn = getCap(clockContainer, 'now', 'clock') ?? (() => Date.now());

  const [platformValue, architectureValue, releaseRaw, familyValue, versionValue, separatorValue, caseRaw] = await Promise.all([
    platformFn(), architectureFn(), callCapability(releaseFn, 'platform.release'), familyFn(), versionFn(), separatorFn(), callCapability(caseFn, 'path.caseSensitivity'),
  ]);
  const release = availability(releaseRaw, 'platform.release');
  const caseSensitivity = availability(caseRaw, 'path.caseSensitivity');
  const stable = {
    osFamily: { status: 'available', value: normalizeOs(platformValue) },
    architecture: { status: 'available', value: normalizeArch(architectureValue) },
    platformRelease: release,
    runtimeFamily: { status: 'available', value: boundedString(String(familyValue), 'runtime.family', 64) },
    runtimeMajor: { status: 'available', value: runtimeMajor(versionValue) },
    pathSeparator: { status: 'available', value: normalizeSeparator(separatorValue) },
    filesystemCaseSensitivity: caseSensitivity.status === 'available' ? { status: 'available', value: normalizeCase(caseSensitivity.value).value } : caseSensitivity,
    environment: normalizeEnvironment(environment),
  };
  if (Object.keys(stable).length > MAX_STABLE_FIELDS) fail('LIMIT_EXCEEDED', 'stable field count exceeds bound');

  const capturedAtRaw = await callCapability(clockFn, 'clock.now');
  const timestamp = typeof capturedAtRaw === 'number' ? capturedAtRaw : Number(capturedAtRaw);
  if (!Number.isFinite(timestamp)) fail('INVALID_CAPABILITY_RESULT', 'clock.now must return a finite timestamp');
  const volatile = {
    runtimeVersion: { status: 'available', value: boundedString(String(versionValue), 'runtime.version') },
    capturedAt: { status: 'available', value: new Date(timestamp).toISOString() },
  };
  if (Object.keys(volatile).length > MAX_VOLATILE_FIELDS) fail('LIMIT_EXCEEDED', 'volatile field count exceeds bound');

  const serialization = serializer(stable);
  if (typeof serialization !== 'string') fail('SERIALIZATION_FAILURE', 'serialize capability must return a string');
  if (Buffer.byteLength(serialization, 'utf8') > MAX_SERIALIZED) fail('LIMIT_EXCEEDED', 'stable serialization exceeds bound');
  const identity = hash(serialization);
  if (typeof identity !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(identity)) fail('INVALID_DIGEST', 'hash capability must return sha256:<64 lowercase hex>');
  return freezeDeep({ format: FORMAT, stable, volatile, identity, serialization });
}

export function serializeHostFingerprint(fingerprint) {
  if (!validateFingerprint(fingerprint)) fail('INVALID_FINGERPRINT', 'fingerprint violates the HIF1 contract');
  const serialized = canonicalize({ format: FORMAT, stable: fingerprint.stable, volatile: fingerprint.volatile, identity: fingerprint.identity });
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED) fail('LIMIT_EXCEEDED', 'fingerprint serialization exceeds bound');
  return serialized;
}

export function compareHostFingerprints(left, right, options = {}) {
  if (!plain(options)) return { format: FORMAT, verdict: 'invalid' };
  if (!validateFingerprint(left) || !validateFingerprint(right)) return { format: FORMAT, verdict: 'invalid' };
  const verbose = readData(options, 'verbose', 'options') === true;
  if (left.identity !== right.identity) {
    const result = { format: FORMAT, verdict: 'different_identity' };
    if (verbose) result.differences = diffValues(left.stable, right.stable, 'stable');
    return freezeDeep(result);
  }
  const result = { format: FORMAT, verdict: 'same_identity' };
  if (verbose) result.differences = diffValues(left.volatile, right.volatile, 'volatile');
  return freezeDeep(result);
}

export const HOST_IDENTITY_FORMAT = FORMAT;
export const HOST_IDENTITY_STATUSES = Object.freeze([...STATUS].sort());
