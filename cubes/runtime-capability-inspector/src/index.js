import { createHash } from 'node:crypto';
import { accessSync, constants as fsConstants } from 'node:fs';
import * as os from 'node:os';
import process from 'node:process';

const FORMAT = 'RCI1';
const MAX_EXECUTABLES = 64;
const MAX_PATH_ENTRIES = 128;
const MAX_NAME = 256;
const MAX_LIST = 32;
const MAX_PAYLOAD = 64 * 1024;
const MAX_DEPTH = 12;
const EXECUTABLE_NAME = /^[A-Za-z0-9][A-Za-z0-9._:+@/-]{0,255}$/;
const OS_FAMILIES = new Set(['linux', 'darwin', 'win32', 'freebsd', 'openbsd', 'sunos', 'aix', 'android', 'other']);
const ARCHITECTURES = new Set(['x64', 'arm64', 'arm', 'ia32', 'ppc64', 'ppc64le', 's390x', 'riscv64', 'loong64', 'other']);

export class RuntimeCapabilityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RuntimeCapabilityError';
    this.code = code;
    Object.freeze(this);
  }
}

const fail = (code, message) => { throw new RuntimeCapabilityError(code, message); };

function validateSafe(value, label, seen = new Set(), depth = 0) {
  if (depth > MAX_DEPTH) fail('DEPTH_LIMIT', `${label} exceeds maximum depth`);
  if (value === null) return;
  const type = typeof value;
  if (type === 'function' || type === 'symbol' || type === 'bigint' || type === 'undefined') fail('UNSUPPORTED_VALUE', `${label} contains unsupported value`);
  if (type === 'number' && !Number.isFinite(value)) fail('UNSUPPORTED_VALUE', `${label} contains a non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} contains a circular reference`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) fail('UNSUPPORTED_VALUE', `${label} must be a plain object`);
  seen.add(value);
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    validateSafe(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function stringValue(value, label, max = MAX_NAME) {
  if (typeof value !== 'string' || value.length === 0) fail('INVALID_INPUT', `${label} must be a non-empty string`);
  if (value.length > max) fail('LIMIT_EXCEEDED', `${label} exceeds ${max} characters`);
  return value;
}

function listValue(value, label, max = MAX_LIST) {
  if (!Array.isArray(value)) fail('INVALID_INPUT', `${label} must be an array`);
  if (value.length > max) fail('LIMIT_EXCEEDED', `${label} exceeds ${max} entries`);
  return value;
}

function normalizeOs(value) {
  const raw = value === 'win32' ? 'win32' : value;
  return OS_FAMILIES.has(raw) ? raw : 'other';
}

function normalizeArch(value) {
  return ARCHITECTURES.has(value) ? value : 'other';
}

function parseNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version ?? '');
  if (!match) fail('INVALID_RUNTIME', 'Node.js runtime version is malformed');
  return Object.freeze({
    version: `v${match[1]}.${match[2]}.${match[3]}`,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  });
}

function canonicalize(value) {
  validateSafe(value, 'value');
  try {
    return JSON.stringify(value, (_, item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
      return item;
    });
  } catch {
    fail('UNSUPPORTED_VALUE', 'value cannot be serialized deterministically');
  }
}

function checksum(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function clone(value) {
  return JSON.parse(canonicalize(value));
}

function windowsCandidates(name, envPathExt) {
  if (process.platform !== 'win32') return [name];
  if (/\.[A-Za-z0-9]+$/.test(name)) return [name];
  const extensions = String(envPathExt || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  return extensions.map((extension) => `${name}${extension}`);
}

function executableAvailable(name, envPath, pathExt) {
  const candidates = windowsCandidates(name, pathExt);
  for (const directory of envPath) {
    for (const candidate of candidates) {
      const fullPath = directory ? `${directory}/${candidate}` : candidate;
      try {
        accessSync(fullPath, fsConstants.X_OK);
        return true;
      } catch {
        try { accessSync(fullPath, fsConstants.F_OK); if (process.platform === 'win32') return true; } catch { /* absent */ }
      }
    }
  }
  return false;
}

function normalizeExecutableRequests(requests) {
  const items = listValue(requests ?? [], 'executables', MAX_EXECUTABLES).map((name, index) => {
    stringValue(name, `executables[${index}]`);
    if (!EXECUTABLE_NAME.test(name)) fail('INVALID_EXECUTABLE', `executables[${index}] is malformed`);
    return name;
  });
  const unique = [...new Set(items)].sort();
  if (unique.length !== items.length) fail('DUPLICATE_EXECUTABLE', 'executables contains duplicates');
  return unique;
}

function capturePaths(envPath) {
  const raw = typeof envPath === 'string' ? envPath : '';
  const entries = raw.split(process.platform === 'win32' ? ';' : ':').filter(Boolean);
  if (entries.length > MAX_PATH_ENTRIES) fail('LIMIT_EXCEEDED', `PATH exceeds ${MAX_PATH_ENTRIES} entries`);
  return entries;
}

export function inspectRuntime(options = {}) {
  validateSafe(options, 'options');
  const executables = normalizeExecutableRequests(options.executables);
  const env = options.env === undefined ? process.env : options.env;
  validateSafe(env, 'env');
  if (!env || typeof env !== 'object' || Array.isArray(env)) fail('INVALID_ENV', 'env must be a plain object');
  const pathEntries = capturePaths(env.PATH ?? env.Path ?? '');
  const nodeRuntime = parseNodeVersion(options.nodeVersion ?? process.version);
  const platform = normalizeOs(options.platform ?? process.platform);
  const architecture = normalizeArch(options.arch ?? process.arch);
  const cpuCount = Number.isInteger(options.cpuCount) ? options.cpuCount : os.cpus().length;
  const memoryBytes = Number.isSafeInteger(options.totalMemoryBytes) ? options.totalMemoryBytes : os.totalmem();
  if (!Number.isInteger(cpuCount) || cpuCount < 1 || cpuCount > 65536) fail('INVALID_RUNTIME', 'cpuCount is invalid');
  if (!Number.isSafeInteger(memoryBytes) || memoryBytes < 0) fail('INVALID_RUNTIME', 'totalMemoryBytes is invalid');

  const executableResults = executables.map((name) => Object.freeze({ name, available: executableAvailable(name, pathEntries, env.PATHEXT) }));
  const release = String(options.release ?? os.release());
  stringValue(release, 'release', 1024);

  return deepFreeze({
    format: FORMAT,
    mode: 'runtime_capability_snapshot',
    platform: { os: platform, release, architecture, endianness: os.endianness() },
    runtime: { node: nodeRuntime },
    resources: { cpuCount, totalMemoryBytes: memoryBytes },
    environment: { pathConfigured: pathEntries.length > 0, executableResults },
  });
}

function normalizeRequirementList(value, label, mapper) {
  const items = listValue(value ?? [], label, MAX_LIST).map((item, index) => mapper(item, `${label}[${index}]`));
  const unique = [...new Set(items)].sort();
  if (unique.length !== items.length) fail('DUPLICATE_REQUIREMENT', `${label} contains duplicates`);
  return unique;
}

function normalizeRequirements(requirements) {
  validateSafe(requirements, 'requirements');
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) fail('INVALID_REQUIREMENTS', 'requirements must be a plain object');
  const osFamilies = normalizeRequirementList(requirements.os, 'requirements.os', (value, label) => {
    stringValue(value, label, 32);
    const normalized = normalizeOs(value);
    if (normalized === 'other' && value !== 'other') fail('INVALID_REQUIREMENT', `${label} contains unsupported OS`);
    return normalized;
  });
  const architectures = normalizeRequirementList(requirements.architectures, 'requirements.architectures', (value, label) => {
    stringValue(value, label, 32);
    const normalized = normalizeArch(value);
    if (normalized === 'other' && value !== 'other') fail('INVALID_REQUIREMENT', `${label} contains unsupported architecture`);
    return normalized;
  });
  const requiredExecutables = normalizeExecutableRequests(requirements.requiredExecutables ?? []);
  const numeric = (value, label) => value === undefined ? null : (Number.isSafeInteger(value) && value >= 0 ? value : fail('INVALID_REQUIREMENT', `${label} must be a non-negative safe integer`));
  const nodeMajorMin = numeric(requirements.nodeMajorMin, 'requirements.nodeMajorMin');
  const nodeMajorMax = numeric(requirements.nodeMajorMax, 'requirements.nodeMajorMax');
  if (nodeMajorMin !== null && nodeMajorMax !== null && nodeMajorMin > nodeMajorMax) fail('INVALID_REQUIREMENT', 'nodeMajorMin exceeds nodeMajorMax');
  return {
    os: osFamilies,
    architectures,
    nodeMajorMin,
    nodeMajorMax,
    requiredExecutables,
    minCpuCount: numeric(requirements.minCpuCount, 'requirements.minCpuCount'),
    minMemoryBytes: numeric(requirements.minMemoryBytes, 'requirements.minMemoryBytes'),
  };
}

export function evaluateRuntimeRequirements(snapshot, requirements) {
  validateSafe(snapshot, 'snapshot');
  const normalized = normalizeRequirements(requirements);
  if (!snapshot || snapshot.format !== FORMAT || snapshot.mode !== 'runtime_capability_snapshot') fail('INVALID_SNAPSHOT', 'invalid runtime snapshot');
  const failures = [];
  if (normalized.os.length > 0 && !normalized.os.includes(snapshot.platform.os)) failures.push({ code: 'OS_MISMATCH', expected: normalized.os, actual: snapshot.platform.os });
  if (normalized.architectures.length > 0 && !normalized.architectures.includes(snapshot.platform.architecture)) failures.push({ code: 'ARCHITECTURE_MISMATCH', expected: normalized.architectures, actual: snapshot.platform.architecture });
  const major = snapshot.runtime?.node?.major;
  if (!Number.isInteger(major)) fail('INVALID_SNAPSHOT', 'snapshot Node major is invalid');
  if (normalized.nodeMajorMin !== null && major < normalized.nodeMajorMin) failures.push({ code: 'NODE_VERSION_TOO_OLD', minimum: normalized.nodeMajorMin, actual: major });
  if (normalized.nodeMajorMax !== null && major > normalized.nodeMajorMax) failures.push({ code: 'NODE_VERSION_TOO_NEW', maximum: normalized.nodeMajorMax, actual: major });
  if (normalized.minCpuCount !== null && snapshot.resources.cpuCount < normalized.minCpuCount) failures.push({ code: 'CPU_COUNT_TOO_LOW', minimum: normalized.minCpuCount, actual: snapshot.resources.cpuCount });
  if (normalized.minMemoryBytes !== null && snapshot.resources.totalMemoryBytes < normalized.minMemoryBytes) failures.push({ code: 'MEMORY_TOO_LOW', minimum: normalized.minMemoryBytes, actual: snapshot.resources.totalMemoryBytes });
  const executableMap = new Map(snapshot.environment.executableResults.map((entry) => [entry.name, entry.available]));
  for (const name of normalized.requiredExecutables) if (executableMap.get(name) !== true) failures.push({ code: 'EXECUTABLE_MISSING', name });
  return deepFreeze({
    format: FORMAT,
    mode: 'runtime_capability_verdict',
    passed: failures.length === 0,
    failures,
  });
}

export function serializeRuntimeReport(report) {
  const payload = canonicalize(report);
  if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD) fail('LIMIT_EXCEEDED', `payload exceeds ${MAX_PAYLOAD} bytes`);
  return canonicalize({ format: FORMAT, checksum: checksum(payload), payload });
}

export function parseRuntimeReport(serialized) {
  stringValue(serialized, 'serialized', MAX_PAYLOAD);
  let envelope;
  try { envelope = JSON.parse(serialized); } catch { fail('MALFORMED_SERIALIZATION', 'serialized report is invalid JSON'); }
  validateSafe(envelope, 'envelope');
  if (envelope.format !== FORMAT) fail('INVALID_FORMAT', 'unsupported report format');
  stringValue(envelope.payload, 'envelope.payload', MAX_PAYLOAD);
  stringValue(envelope.checksum, 'envelope.checksum', 64);
  if (!/^[0-9a-f]{64}$/.test(envelope.checksum)) fail('INVALID_CHECKSUM', 'checksum is malformed');
  if (checksum(envelope.payload) !== envelope.checksum) fail('INTEGRITY_MISMATCH', 'runtime report checksum mismatch');
  let payload;
  try { payload = JSON.parse(envelope.payload); } catch { fail('MALFORMED_SERIALIZATION', 'report payload is invalid JSON'); }
  return deepFreeze(clone(payload));
}

export const RUNTIME_CAPABILITY_FORMAT = FORMAT;
export const RUNTIME_OS_FAMILIES = Object.freeze([...OS_FAMILIES]);
export const RUNTIME_ARCHITECTURES = Object.freeze([...ARCHITECTURES]);
