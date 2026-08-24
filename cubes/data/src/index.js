export class DataCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'DataCubeError';
    this.code = code;
    this.cause = options.cause;
  }
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function pathParts(path) {
  if (Array.isArray(path)) return path;
  if (typeof path !== 'string' || path.length === 0) throw new DataCubeError('INVALID_PATH', 'Path must be a non-empty string or array');
  return path.split('.').filter(Boolean);
}

export function get(data, path, fallback = undefined) {
  let current = data;
  for (const part of pathParts(path)) {
    if (current == null || !(part in Object(current))) return fallback;
    current = current[part];
  }
  return current;
}

export function set(data, path, value) {
  if (data == null || typeof data !== 'object') throw new DataCubeError('INVALID_DATA', 'set expects an object');
  const parts = pathParts(path);
  let current = data;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== 'object') current[part] = {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
  return data;
}

export function omit(data, paths = []) {
  const output = clone(data);
  for (const path of paths) {
    const parts = pathParts(path);
    let current = output;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (current == null || typeof current !== 'object') break;
      current = current[parts[i]];
    }
    if (current && typeof current === 'object') delete current[parts.at(-1)];
  }
  return output;
}

export function pick(data, paths = []) {
  const output = {};
  for (const path of paths) {
    const value = get(data, path);
    if (value !== undefined) set(output, path, clone(value));
  }
  return output;
}

export function mapKeys(data, mapper) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) throw new DataCubeError('INVALID_DATA', 'mapKeys expects an object');
  if (typeof mapper !== 'function') throw new DataCubeError('INVALID_MAPPER', 'mapper must be a function');
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [mapper(key, value), value]));
}

export function compact(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(compact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, compact(v)]));
  return value;
}

export function normalizeStrings(value, options = {}) {
  const trim = options.trim ?? true;
  const collapseWhitespace = options.collapseWhitespace ?? true;
  const normalizeCase = options.case ?? 'preserve';
  const visit = (item) => {
    if (typeof item === 'string') {
      let result = trim ? item.trim() : item;
      if (collapseWhitespace) result = result.replace(/\s+/g, ' ');
      if (normalizeCase === 'lower') result = result.toLowerCase();
      if (normalizeCase === 'upper') result = result.toUpperCase();
      return result;
    }
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, visit(v)]));
    return item;
  };
  return visit(value);
}

export function dedupe(items, key = (value) => JSON.stringify(value)) {
  if (!Array.isArray(items)) throw new DataCubeError('INVALID_DATA', 'dedupe expects an array');
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const identity = key(item);
    if (seen.has(identity)) continue;
    seen.add(identity);
    output.push(item);
  }
  return output;
}

export function merge(base, overlay, options = {}) {
  const deep = options.deep ?? true;
  if (!deep || !base || typeof base !== 'object' || Array.isArray(base) || !overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
    return { ...base, ...overlay };
  }
  const output = clone(base);
  for (const [key, value] of Object.entries(overlay)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && output[key] && typeof output[key] === 'object' && !Array.isArray(output[key])) output[key] = merge(output[key], value, options);
    else output[key] = clone(value);
  }
  return output;
}

export function canonicalJson(value) {
  const sort = (item) => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])]));
    return item;
  };
  return JSON.stringify(sort(value));
}
