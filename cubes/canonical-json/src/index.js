const DEFAULT_MAX_DEPTH = 32;
const DEFAULT_MAX_NODES = 10000;
const DEFAULT_MAX_STRING_BYTES = 1_048_576;
const DEFAULT_MAX_VALUE_BYTES = 4 * 1_048_576;

const isObject = (value) => value !== null && typeof value === 'object';
const compareKeys = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export class CanonicalJsonError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'CanonicalJsonError';
    this.code = code;
    this.path = options.path ?? null;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

function fail(code, message, options = {}) {
  throw new CanonicalJsonError(code, message, options);
}

function assertPositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_LIMIT', `${name} must be a safe integer >= 1`);
}

function isPlainObject(value) {
  if (!isObject(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function utf8Bytes(value) {
  return Buffer.byteLength(value, 'utf8');
}

function normalizeValue(value, state, depth = 0, path = '') {
  state.nodes += 1;
  if (state.nodes > state.config.maxNodes) fail('NODE_LIMIT', 'Value exceeds the configured node limit', { path, statusCode: 413 });
  if (depth > state.config.maxDepth) fail('DEPTH_LIMIT', 'Value exceeds the configured depth limit', { path, statusCode: 413 });

  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    if (typeof value === 'string' && utf8Bytes(value) > state.config.maxStringBytes) fail('STRING_LIMIT', 'String exceeds the configured size limit', { path, statusCode: 413 });
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('UNSUPPORTED_VALUE', 'Only finite numbers are supported', { path });
    return Object.is(value, -0) ? -0 : value;
  }

  if (typeof value !== 'object') fail('UNSUPPORTED_VALUE', 'Unsupported value type', { path });
  if (!Array.isArray(value) && !isPlainObject(value)) fail('UNSUPPORTED_OBJECT', 'Only arrays and plain objects are supported', { path });
  if (state.active.has(value)) fail('CIRCULAR_REFERENCE', 'Circular reference detected', { path });

  state.active.add(value);
  try {
    if (Array.isArray(value)) {
      const output = value.map((item, index) => normalizeValue(item, state, depth + 1, `${path}/${index}`));
      return Object.freeze(output);
    }

    const output = {};
    for (const key of Object.keys(value).sort(compareKeys)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) fail('UNSUPPORTED_OBJECT', 'Accessor properties are not supported', { path: `${path}/${key}` });
      output[key] = normalizeValue(descriptor.value, state, depth + 1, `${path}/${key}`);
    }
    return Object.freeze(output);
  } finally {
    state.active.delete(value);
  }
}

function canonicalSerialize(value, state, depth = 0, path = '') {
  if (depth > state.config.maxDepth) fail('DEPTH_LIMIT', 'Value exceeds the configured depth limit', { path, statusCode: 413 });

  let output;
  if (value === null) output = 'null';
  else if (typeof value === 'boolean') output = value ? 'true' : 'false';
  else if (typeof value === 'string') output = JSON.stringify(value);
  else if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('UNSUPPORTED_VALUE', 'Only finite numbers are supported', { path });
    output = Object.is(value, -0) ? '-0' : JSON.stringify(value);
  } else if (Array.isArray(value)) {
    output = `[${value.map((item, index) => canonicalSerialize(item, state, depth + 1, `${path}/${index}`)).join(',')}]`;
  } else if (isPlainObject(value)) {
    const entries = Object.keys(value).sort(compareKeys).map((key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key], state, depth + 1, `${path}/${key}`)}`);
    output = `{${entries.join(',')}}`;
  } else {
    fail('UNSUPPORTED_OBJECT', 'Only arrays and plain objects are supported', { path });
  }

  if (utf8Bytes(output) > state.config.maxValueBytes) fail('VALUE_LIMIT', 'Canonical output exceeds the configured serialized size limit', { path, statusCode: 413 });
  return output;
}

export function createCanonicalizer(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) fail('INVALID_OPTIONS', 'Options must be an object');

  const config = Object.freeze({
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxNodes: options.maxNodes ?? DEFAULT_MAX_NODES,
    maxStringBytes: options.maxStringBytes ?? DEFAULT_MAX_STRING_BYTES,
    maxValueBytes: options.maxValueBytes ?? DEFAULT_MAX_VALUE_BYTES,
  });
  for (const [name, value] of Object.entries(config)) assertPositiveInteger(value, name);

  function normalize(value) {
    const state = { config, nodes: 0, active: new WeakSet() };
    const output = normalizeValue(value, state);
    if (utf8Bytes(canonicalSerialize(output, state)) > config.maxValueBytes) fail('VALUE_LIMIT', 'Canonical output exceeds the configured serialized size limit', { statusCode: 413 });
    return output;
  }

  function stringify(value) {
    const normalized = normalize(value);
    const state = { config, nodes: 0, active: new WeakSet() };
    const serialized = canonicalSerialize(normalized, state);
    if (utf8Bytes(serialized) > config.maxValueBytes) fail('VALUE_LIMIT', 'Canonical output exceeds the configured serialized size limit', { statusCode: 413 });
    return serialized;
  }

  return Object.freeze({ config, normalize, stringify });
}

export const normalize = (value, options) => createCanonicalizer(options).normalize(value);
export const canonicalStringify = (value, options) => createCanonicalizer(options).stringify(value);

export {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  DEFAULT_MAX_STRING_BYTES,
  DEFAULT_MAX_VALUE_BYTES,
};
