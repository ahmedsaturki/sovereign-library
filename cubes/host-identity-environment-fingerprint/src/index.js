import { createHash } from 'node:crypto';
import * as os from 'node:os';
import process from 'node:process';
import { sep } from 'node:path';

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
const SENSITIVE = /(pass(word)?|secret|token|private[._-]?key|credential|authorization|cookie|api[._-]?key|access[._-]?key|session[._-]?key|auth)/i;
const OS_FAMILIES = new Set(['linux', 'darwin', 'win32', 'freebsd', 'openbsd', 'sunos', 'aix', 'android', 'other']);
const ARCHITECTURES = new Set(['x64', 'arm64', 'arm', 'ia32', 'ppc64', 'ppc64le', 's390x', 'riscv64', 'loong64', 'other']);

export class HostIdentityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HostIdentityError';
    this.code = code;
    Object.freeze(this);
  }
}

function fail(code, message) { throw new HostIdentityError(code, message); }

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function validatePlain(value, label, seen = new Set(), depth = 0) {
  if (depth > 12) fail('DEPTH_LIMIT', `${label} exceeds maximum depth`);
  if (value === null) return;
  const type = typeof value;
  if (type === 'function' || type === 'symbol' || type === 'bigint' || type === 'undefined') fail('UNSUPPORTED_VALUE', `${label} contains unsupported value`);
  if (type === 'number' && !Number.isFinite(value)) fail('UNSUPPORTED_VALUE', `${label} contains a non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  if (!Array.isArray(value) && !isPlainObject(value)) fail('UNSUPPORTED_VALUE', `${label} must contain plain data`);
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail('UNSUPPORTED_VALUE', `${label} contains symbol keys`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    validatePlain(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function readData(object, key, label) {
  if (!object) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
  return descriptor.value;
}

function capability(value, label) {
  if (typeof value !== 'function') fail('INVALID_CAPABILITY', `${label} must be a function`);
  return value;
}

function boundedString(value, label, max = MAX_FIELD_VALUE, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) fail('INVALID_FIELD', `${label} must be a ${allowEmpty ? 'string' : 'non-empty string'}`);
  if (value.length > max) fail('FIELD_TOO_LARGE', `${label} exceeds ${max} characters`);
  return value;
}

function normalizeStatus(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_CAPABILITY_RESULT', `${label} must return an availability object`);
  const status = readData(value, 'status', label);
  if (typeof status !== 'string' || !STATUS.has(status)) fail('INVALID_CAPABILITY_RESULT', `${label}.status is invalid`);
  if (status === 'available') return { status, value: normalizeValue(readData(value, 'value', label), `${label}.value`) };
  return { status };
}

function normalizeValue(value, label) {
  if (typeof value === 'string') return boundedString(value, label);
  if (value === null || value === undefined) fail('INVALID_CAPABILITY_RESULT', `${label} is missing`);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  fail('INVALID_CAPABILITY_RESULT', `${label} has unsupported type`);
}

function canonicalize(value) {
  validatePlain(value, 'value');
  try {
    return JSON.stringify(value, (_, item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
      }
      return item;
    });
  } catch {
    fail('SERIALIZATION_FAILURE', 'value cannot be serialized deterministically');
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function digest(serialized, hash) {
  const result = hash(serialized);
  if (typeof result !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(result)) fail('INVALID_DIGEST', 'hash capability must return sha256:<64 lowercase hex>');
  return result;
}

function defaultHash(serialized) {
  return `sha256:${createHash('sha256').update(serialized, 'utf8').digest('hex')}`;
}

function capabilityError(error, label) {
  if (error?.code === 'UNSUPPORTED') return { status: 'unsupported' };
  if (error?.code === 'EACCES' || error?.code === 'EPERM' || error?.code === 'PERMISSION_DENIED') return { status: 'permission_denied' };
  if (error?.code === 'UNAVAILABLE') return { status: 'unavailable' };
  fail('CAPABILITY_FAILURE', `${label} failed`);
}

async function callAvailability(fn, label) {
  try {
    const result = await fn();
    return normalizeStatus(result, label);
  } catch (error) {
    return capabilityError(error, label);
  }
}

function normalizeOs(value) {
  const normalized = String(value);
  return OS_FAMILIES.has(normalized) ? normalized : 'other';
}

function normalizeArchitecture(value) {
  const normalized = String(value);
  return ARCHITECTURES.has(normalized) ? normalized : 'other';
}

function normalizeSeparator(value) {
  if (value === '/' || value === '\\') return value;
  fail('INVALID_CAPABILITY_RESULT', 'path separator must be / or \\');
}

function normalizeCaseSensitivity(value) {
  if (value === 'sensitive' || value === 'insensitive' || value === 'unavailable' || value === 'unsupported' || value === 'permission_denied') return value;
  fail('INVALID_CAPABILITY_RESULT', 'caseSensitivity must be an allowed classification');
}

function normalizeRuntimeMajor(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  if (!match) fail('INVALID_CAPABILITY_RESULT', 'runtime version is malformed');
  return Number(match[1]);
}

function normalizeAllowlist(environment) {
  if (!environment) return [];
  const allowlist = readData(environment, 'allowlist', 'environment');
  if (allowlist === undefined) return [];
  if (!Array.isArray(allowlist) || allowlist.length > MAX_ENV_FIELDS) fail('LIMIT_EXCEEDED', `environment.allowlist exceeds ${MAX_ENV_FIELDS} entries`);
  const seen = new Set();
  return allowlist.map((key, index) => {
    boundedString(key, `environment.allowlist[${index}]`, MAX_FIELD_NAME);
    if (SENSITIVE.test(key)) fail('DISALLOWED_SENSITIVE_FIELD', `environment.allowlist[${index}] is sensitive`);
    if (seen.has(key)) fail('DUPLICATE_ENV_FIELD', `environment.allowlist contains duplicate ${key}`);
    seen.add(key);
    return key;
  }).sort();
}

function buildEnvironmentStable(allowlist, values) {
  const result = {};
  let aggregate = 0;
  for (const key of allowlist) {
    if (!(key in values)) continue;
    const value = values[key];
    boundedString(key, 'environment field name', MAX_FIELD_NAME);
    boundedString(value, `environment.${key}`);
    aggregate += key.length + value.length;
    if (aggregate > MAX_ENV_AGGREGATE) fail('LIMIT_EXCEEDED', `environment fields exceed ${MAX_ENV_AGGREGATE} bytes`);
    result[key] = { status: 'available', value };
  }
  return result;
}

function stableFieldCount(stable) {
  return Object.keys(stable).length;
}

function volatileFieldCount(volatile) {
  return Object.keys(volatile).length;
}

function validateFingerprintShape(fingerprint) {
  validatePlain(fingerprint, 'fingerprint');
  if (!isPlainObject(fingerprint) || fingerprint.format !== FORMAT) fail('INVALID_FINGERPRINT', 'fingerprint format is invalid');
  if (!isPlainObject(fingerprint.stable) || !isPlainObject(fingerprint.volatile)) fail('INVALID_FINGERPRINT', 'fingerprint fields are invalid');
  if (stableFieldCount(fingerprint.stable) > MAX_STABLE_FIELDS || volatileFieldCount(fingerprint.volatile) > MAX_VOLATILE_FIELDS) fail('LIMIT_EXCEEDED', 'fingerprint field count exceeds bound');
  boundedString(fingerprint.identity, 'fingerprint.identity', 71);
  if (!/^sha256:[0-9a-f]{64}$/.test(fingerprint.identity)) fail('INVALID_FINGERPRINT', 'fingerprint identity is malformed');
  boundedString(fingerprint.serialization, 'fingerprint.serialization', MAX_SERIALIZED);
  if (Buffer.byteLength(fingerprint.serialization, 'utf8') > MAX_SERIALIZED) fail('LIMIT_EXCEEDED', 'fingerprint serialization exceeds bound');
  return fingerprint;
}

function collectDiffs(left, right, section, path = '', diffs = []) {
  if (diffs.length >= MAX_DIFFS) return diffs;
  const leftKeys = isPlainObject(left) ? Object.keys(left).sort() : [];
  const rightKeys = isPlainObject(right) ? Object.keys(right).sort() : [];
  for (const key of [...new Set([...leftKeys, ...rightKeys])].sort()) {
    if (diffs.length >= MAX_DIFFS) break;
    const childPath = path ? `${path}.${key}` : key;
    const a = left?.[key];
    const b = right?.[key];
    if (isPlainObject(a) && isPlainObject(b)) collectDiffs(a, b, section, childPath, diffs);
    else if (canonicalize(a) !== canonicalize(b)) diffs.push({ section, path: childPath, left: a, right: b });
  }
  return diffs;
}

export async function fingerprintHost(rawOptions = {}) {
  if (!isPlainObject(rawOptions)) fail('INVALID_OPTIONS', 'options must be a plain object');
  validatePlain(rawOptions, 'options');
  const platformCaps = readData(rawOptions, 'platform', 'options') ?? {};
  const runtimeCaps = readData(rawOptions, 'runtime', 'options') ?? {};
  const pathCaps = readData(rawOptions, 'path', 'options') ?? {};
  const environment = readData(rawOptions, 'environment', 'options') ?? {};
  const clock = capability(readData(rawOptions, 'clock', 'options')?.now ?? (() => Date.now()), 'clock.now');
  const serializer = capability(readData(rawOptions, 'serialize', 'options') ?? canonicalize, 'serialize');
  const hash = capability(readData(rawOptions, 'hash', 'options') ?? defaultHash, 'hash');

  const platformValue = readData(platformCaps, 'platform', 'platform') ?? (() => process.platform)();
  const architectureValue = readData(platformCaps, 'architecture', 'platform') ?? (() => process.arch)();
  const releaseValue = readData(platformCaps, 'release', 'platform');
  const runtimeFamilyValue = readData(runtimeCaps, 'family', 'runtime') ?? 'node';
  const runtimeVersionFn = readData(runtimeCaps, 'version', 'runtime');
  const runtimeVersionValue = runtimeVersionFn === undefined ? process.version : await capability(runtimeVersionFn, 'runtime.version')();
  const separatorFn = readData(pathCaps, 'separator', 'path');
  const caseFn = readData(pathCaps, 'caseSensitivity', 'path');

  const [platformRelease, caseSensitivity] = await Promise.all([
    releaseValue === undefined ? { status: 'available', value: boundedString(os.release(), 'platform.release', MAX_FIELD_VALUE) } : callAvailability(capability(releaseValue, 'platform.release'), 'platform.release'),
    caseFn === undefined ? { status: 'unavailable' } : callAvailability(capability(caseFn, 'path.caseSensitivity'), 'path.caseSensitivity'),
  ]);

  const pathSeparator = separatorFn === undefined ? (process.platform === 'win32' ? '\\' : '/') : normalizeSeparator(await capability(separatorFn, 'path.separator')());
  const runtimeMajor = normalizeRuntimeMajor(runtimeVersionValue);
  const allowlist = normalizeAllowlist(environment);
  const envValues = readData(environment, 'values', 'environment') ?? {};
  if (!isPlainObject(envValues)) fail('INVALID_ENVIRONMENT', 'environment.values must be a plain object');
  const environmentStable = buildEnvironmentStable(allowlist, envValues);

  const stable = {
    osFamily: normalizeStatus({ status: 'available', value: normalizeOs(platformValue) }, 'osFamily'),
    architecture: normalizeStatus({ status: 'available', value: normalizeArchitecture(architectureValue) }, 'architecture'),
    platformRelease,
    runtimeFamily: normalizeStatus({ status: 'available', value: boundedString(String(runtimeFamilyValue), 'runtime.family', 64) }, 'runtimeFamily'),
    runtimeMajor: normalizeStatus({ status: 'available', value: runtimeMajor }, 'runtimeMajor'),
    pathSeparator: normalizeStatus({ status: 'available', value: pathSeparator }, 'pathSeparator'),
    filesystemCaseSensitivity: normalizeStatus({ status: caseSensitivity.status, value: caseSensitivity.status === 'available' ? normalizeCaseSensitivity(caseSensitivity.value) : caseSensitivity.status }, 'filesystemCaseSensitivity'),
    environment: environmentStable,
  };
  if (stableFieldCount(stable) > MAX_STABLE_FIELDS) fail('LIMIT_EXCEEDED', 'stable field count exceeds bound');

  const volatile = {
    runtimeVersion: normalizeStatus({ status: 'available', value: boundedString(String(runtimeVersionValue), 'runtime.version', MAX_FIELD_VALUE) }, 'runtimeVersion'),
    capturedAt: normalizeStatus({ status: 'available', value: new Date(clock()).toISOString() }, 'capturedAt'),
  };
  if (volatileFieldCount(volatile) > MAX_VOLATILE_FIELDS) fail('LIMIT_EXCEEDED', 'volatile field count exceeds bound');

  const stableSerialization = serializer(stable);
  if (typeof stableSerialization !== 'string') fail('SERIALIZATION_FAILURE', 'serialize capability must return a string');
  if (Buffer.byteLength(stableSerialization, 'utf8') > MAX_SERIALIZED) fail('LIMIT_EXCEEDED', 'stable serialization exceeds bound');
  const identity = digest(stableSerialization, hash);
  const fingerprint = { format: FORMAT, stable, volatile, identity, serialization: stableSerialization };
  return deepFreeze(fingerprint);
}

export function serializeHostFingerprint(fingerprint) {
  validateFingerprintShape(fingerprint);
  const payload = { format: FORMAT, stable: fingerprint.stable, volatile: fingerprint.volatile, identity: fingerprint.identity };
  const serialized = canonicalize(payload);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED) fail('LIMIT_EXCEEDED', 'fingerprint serialization exceeds bound');
  return serialized;
}

export function compareHostFingerprints(left, right, options = {}) {
  validateFingerprintShape(left);
  validateFingerprintShape(right);
  if (left.identity !== right.identity) {
    const result = { format: FORMAT, verdict: 'different_identity' };
    if (options?.verbose === true) result.differences = collectDiffs(left.stable, right.stable, 'stable');
    return deepFreeze(result);
  }
  const result = { format: FORMAT, verdict: 'same_identity' };
  if (options?.verbose === true) result.differences = collectDiffs(left.volatile, right.volatile, 'volatile');
  return deepFreeze(result);
}

export const HOST_IDENTITY_FORMAT = FORMAT;
export const HOST_IDENTITY_STATUSES = Object.freeze([...STATUS].sort());
