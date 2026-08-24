export class ConfigCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'ConfigCubeError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
  }
}

const TYPES = Object.freeze(['string', 'integer', 'number', 'boolean', 'url', 'json']);
const SECRET_KEYS = /(?:pass(word)?|secret|token|api[_-]?key|private[_-]?key|credential|auth)/i;
const DEFAULT_MAX_VALUE_LENGTH = 64 * 1024;

function assertKey(key) {
  if (typeof key !== 'string' || key.length === 0 || key.length > 256) {
    throw new ConfigCubeError('INVALID_KEY', 'configuration key must be a non-empty string <= 256 characters');
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(key)) {
    throw new ConfigCubeError('INVALID_KEY', `invalid configuration key: ${key}`);
  }
}

function assertName(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new ConfigCubeError('INVALID_NAME', `${label} must be a non-empty string <= 128 characters`);
  }
}

function parseBoolean(value) {
  if (value === true || value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === false || value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  throw new ConfigCubeError('INVALID_BOOLEAN', `invalid boolean value: ${value}`);
}

function parseValue(raw, type) {
  if (!TYPES.includes(type)) throw new ConfigCubeError('INVALID_TYPE', `unsupported config type: ${type}`);
  if (typeof raw !== 'string') return raw;
  if (type === 'string') return raw;
  if (type === 'boolean') return parseBoolean(raw);
  if (type === 'integer') {
    if (!/^-?\d+$/.test(raw.trim())) throw new ConfigCubeError('INVALID_INTEGER', `invalid integer value: ${raw}`);
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) throw new ConfigCubeError('INVALID_INTEGER', `integer is outside the safe range: ${raw}`);
    return value;
  }
  if (type === 'number') {
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new ConfigCubeError('INVALID_NUMBER', `invalid number value: ${raw}`);
    return value;
  }
  if (type === 'url') {
    try {
      const url = new URL(raw);
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) throw new Error('unsupported protocol');
      return url.toString();
    } catch (error) {
      throw new ConfigCubeError('INVALID_URL', `invalid URL value: ${raw}`, { cause: error });
    }
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new ConfigCubeError('INVALID_JSON', 'invalid JSON value', { cause: error });
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value)) deepFreeze(item, seen);
  return Object.freeze(value);
}

export class MemorySource {
  constructor(values = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new ConfigCubeError('INVALID_SOURCE', 'source must be a plain object');
    }
    this.values = Object.freeze({ ...values });
  }
  get(key) { return Object.hasOwn(this.values, key) ? this.values[key] : undefined; }
}

export class EnvironmentSource {
  constructor(environment = process.env) {
    if (!environment || typeof environment !== 'object') throw new ConfigCubeError('INVALID_SOURCE', 'environment must be object-like');
    this.environment = environment;
  }
  get(key) { return this.environment[key]; }
}

export function redactKey(key) {
  assertKey(key);
  return SECRET_KEYS.test(key) ? '[REDACTED]' : key;
}

export function redactValue(key, value) {
  assertKey(key);
  return SECRET_KEYS.test(key) ? '[REDACTED]' : value;
}

export function redactConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new ConfigCubeError('INVALID_CONFIG', 'config must be an object');
  const out = {};
  for (const [key, value] of Object.entries(config)) {
    out[key] = SECRET_KEYS.test(key)
      ? '[REDACTED]'
      : value && typeof value === 'object' && !Array.isArray(value)
        ? redactConfig(value)
        : Array.isArray(value)
          ? value.map(item => item && typeof item === 'object' ? redactConfig(item) : item)
          : value;
  }
  return deepFreeze(out);
}

export class ConfigBuilder {
  constructor({ sources = [], maxValueLength = DEFAULT_MAX_VALUE_LENGTH } = {}) {
    if (!Array.isArray(sources)) throw new ConfigCubeError('INVALID_SOURCES', 'sources must be an array');
    if (!Number.isSafeInteger(maxValueLength) || maxValueLength < 1) throw new ConfigCubeError('INVALID_MAX_VALUE_LENGTH', 'maxValueLength must be a safe integer >= 1');
    this.sources = sources.slice();
    this.maxValueLength = maxValueLength;
    this.schema = new Map();
  }

  define(key, options = {}) {
    assertKey(key);
    const { type = 'string', required = false, defaultValue, namespace } = options;
    if (!TYPES.includes(type)) throw new ConfigCubeError('INVALID_TYPE', `unsupported config type: ${type}`);
    if (typeof required !== 'boolean') throw new ConfigCubeError('INVALID_REQUIRED', 'required must be boolean');
    if (namespace !== undefined) assertName(namespace, 'namespace');
    const entry = Object.freeze({ key, type, required, defaultValue, namespace });
    this.schema.set(key, entry);
    return this;
  }

  build() {
    const result = {};
    for (const [key, entry] of this.schema) {
      const sourceKey = entry.namespace ? `${entry.namespace}_${key}` : key;
      let raw;
      for (let index = this.sources.length - 1; index >= 0; index -= 1) {
        const candidate = this.sources[index]?.get(sourceKey);
        if (candidate !== undefined) { raw = candidate; break; }
      }
      if (raw === undefined) raw = entry.defaultValue;
      if (raw === undefined) {
        if (entry.required) throw new ConfigCubeError('MISSING_REQUIRED', `missing required configuration: ${sourceKey}`);
        continue;
      }
      if (typeof raw === 'string' && raw.length > this.maxValueLength) {
        throw new ConfigCubeError('VALUE_TOO_LARGE', `configuration value exceeds ${this.maxValueLength} characters: ${sourceKey}`);
      }
      const value = typeof raw === 'string' ? parseValue(raw, entry.type) : raw;
      result[key] = value;
    }
    return deepFreeze(result);
  }
}

export function createConfig(options) {
  return new ConfigBuilder(options);
}

export { TYPES, DEFAULT_MAX_VALUE_LENGTH };
