const DEFAULT_MAX_DEPTH = 32;
const DEFAULT_MAX_NODES = 10000;
const DEFAULT_MAX_OPERATIONS = 10000;
const DEFAULT_MAX_STRING_BYTES = 1_048_576;
const DEFAULT_MAX_VALUE_BYTES = 4 * 1_048_576;

const isObject = (value) => value !== null && typeof value === 'object';
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export class DiffPatchError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'DiffPatchError';
    this.code = code;
    this.path = options.path ?? null;
    this.operationIndex = options.operationIndex ?? null;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new DiffPatchError('INVALID_LIMIT', `${name} must be a safe integer >= 1`);
  }
}

function isPlainObject(value) {
  if (!isObject(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function utf8Bytes(value) {
  return Buffer.byteLength(value, 'utf8');
}

function escapeToken(token) {
  return token.replaceAll('~', '~0').replaceAll('/', '~1');
}

function unescapeToken(token) {
  if (/~(?![01])/.test(token)) throw new DiffPatchError('INVALID_PATH', 'Path contains an invalid escape sequence');
  return token.replaceAll('~1', '/').replaceAll('~0', '~');
}

function parsePointer(path) {
  if (typeof path !== 'string' || path.length > 65536) throw new DiffPatchError('INVALID_PATH', 'Path must be a bounded string');
  if (path === '') return [];
  if (!path.startsWith('/')) throw new DiffPatchError('INVALID_PATH', 'Path must be empty or start with /');
  return path.slice(1).split('/').map(unescapeToken);
}

function formatPath(parent, token) {
  return `${parent}/${escapeToken(token)}`;
}

function cloneAndValidate(value, state, depth = 0, path = '') {
  state.nodes += 1;
  if (state.nodes > state.config.maxNodes) throw new DiffPatchError('NODE_LIMIT', 'Value exceeds the configured node limit', { path, statusCode: 413 });
  if (depth > state.config.maxDepth) throw new DiffPatchError('DEPTH_LIMIT', 'Value exceeds the configured depth limit', { path, statusCode: 413 });

  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new DiffPatchError('UNSUPPORTED_VALUE', 'Only finite numbers are supported', { path });
    return value;
  }
  if (typeof value === 'string') {
    if (utf8Bytes(value) > state.config.maxStringBytes) throw new DiffPatchError('STRING_LIMIT', 'String exceeds the configured size limit', { path, statusCode: 413 });
    return value;
  }
  if (!isObject(value)) throw new DiffPatchError('UNSUPPORTED_VALUE', 'Unsupported value type', { path });

  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new DiffPatchError('UNSUPPORTED_OBJECT', 'Only arrays and plain objects are supported', { path });
  }

  if (Array.isArray(value)) {
    const output = value.map((item, index) => cloneAndValidate(item, state, depth + 1, `${path}/${index}`));
    return Object.freeze(output);
  }

  const output = {};
  for (const key of Object.keys(value).sort(compare)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new DiffPatchError('UNSUPPORTED_OBJECT', 'Accessor properties are not supported', { path: formatPath(path, key) });
    output[key] = cloneAndValidate(descriptor.value, state, depth + 1, formatPath(path, key));
  }
  return Object.freeze(output);
}

function valueBytes(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (cause) {
    throw new DiffPatchError('SERIALIZATION_FAILED', 'Value could not be serialized safely', { cause });
  }
  const bytes = utf8Bytes(serialized);
  return bytes;
}

function freezeOperation(operation) {
  if (Object.hasOwn(operation, 'value') && isObject(operation.value)) Object.freeze(operation.value);
  return Object.freeze(operation);
}

export function createDiffEngine(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new DiffPatchError('INVALID_OPTIONS', 'Options must be an object');
  }
  const config = Object.freeze({
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxNodes: options.maxNodes ?? DEFAULT_MAX_NODES,
    maxOperations: options.maxOperations ?? DEFAULT_MAX_OPERATIONS,
    maxStringBytes: options.maxStringBytes ?? DEFAULT_MAX_STRING_BYTES,
    maxValueBytes: options.maxValueBytes ?? DEFAULT_MAX_VALUE_BYTES,
  });
  for (const [name, value] of Object.entries(config)) assertPositiveInteger(value, name);

  function validateRoot(value) {
    const state = { config, nodes: 0 };
    const clone = cloneAndValidate(value, state);
    if (valueBytes(clone) > config.maxValueBytes) throw new DiffPatchError('VALUE_LIMIT', 'Value exceeds the configured serialized size limit', { statusCode: 413 });
    return clone;
  }

  function diff(before, after) {
    const left = validateRoot(before);
    const right = validateRoot(after);
    const operations = [];

    const addOperation = (operation) => {
      if (operations.length >= config.maxOperations) throw new DiffPatchError('OPERATION_LIMIT', 'Diff exceeds the configured operation limit', { path: operation.path, statusCode: 413 });
      operations.push(freezeOperation(operation));
    };

    function walk(a, b, path, depth) {
      if (depth > config.maxDepth) throw new DiffPatchError('DEPTH_LIMIT', 'Diff exceeds the configured depth limit', { path, statusCode: 413 });
      if (Object.is(a, b)) return;

      const arrays = Array.isArray(a) && Array.isArray(b);
      const objects = isPlainObject(a) && isPlainObject(b);
      if (!arrays && !objects) {
        addOperation({ op: path === '' ? 'replace' : 'replace', path, value: b });
        return;
      }

      if (arrays) {
        const common = Math.min(a.length, b.length);
        for (let index = 0; index < common; index += 1) walk(a[index], b[index], `${path}/${index}`, depth + 1);
        for (let index = a.length - 1; index >= b.length; index -= 1) addOperation({ op: 'remove', path: `${path}/${index}` });
        for (let index = common; index < b.length; index += 1) addOperation({ op: 'add', path: `${path}/${index}`, value: b[index] });
        return;
      }

      const keysA = Object.keys(a).sort(compare);
      const keysB = Object.keys(b).sort(compare);
      const setA = new Set(keysA);
      const setB = new Set(keysB);
      for (const key of keysA) if (!setB.has(key)) addOperation({ op: 'remove', path: formatPath(path, key) });
      for (const key of keysB) {
        const childPath = formatPath(path, key);
        if (!setA.has(key)) addOperation({ op: 'add', path: childPath, value: b[key] });
        else walk(a[key], b[key], childPath, depth + 1);
      }
    }

    walk(left, right, '', 0);
    return Object.freeze(operations);
  }

  function applyPatch(source, operations) {
    const root = validateRoot(source);
    if (!Array.isArray(operations)) throw new DiffPatchError('INVALID_OPERATIONS', 'Operations must be an array');
    if (operations.length > config.maxOperations) throw new DiffPatchError('OPERATION_LIMIT', 'Patch exceeds the configured operation limit', { statusCode: 413 });

    const normalized = operations.map((operation, operationIndex) => normalizeOperation(operation, operationIndex, config));
    const seenPaths = new Set();
    for (const operation of normalized) {
      if (seenPaths.has(operation.path)) throw new DiffPatchError('CONFLICTING_OPERATION', 'Duplicate operation path is not allowed', { path: operation.path, operationIndex: operation.index });
      seenPaths.add(operation.path);
    }

    let output = root;
    for (const operation of normalized) output = applyOne(output, operation, config);
    if (valueBytes(output) > config.maxValueBytes) throw new DiffPatchError('VALUE_LIMIT', 'Patched value exceeds the configured serialized size limit', { statusCode: 413 });
    return output;
  }

  return Object.freeze({ config, diff, applyPatch });
}

function normalizeOperation(operation, operationIndex, config) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) throw new DiffPatchError('INVALID_OPERATION', 'Operation must be an object', { operationIndex });
  const allowed = operation.op === 'remove' ? ['op', 'path'] : ['op', 'path', 'value'];
  for (const key of Object.keys(operation)) if (!allowed.includes(key)) throw new DiffPatchError('INVALID_OPERATION', 'Operation contains an unknown member', { operationIndex });
  if (!['add', 'remove', 'replace'].includes(operation.op)) throw new DiffPatchError('INVALID_OPERATION', 'Operation type is unsupported', { operationIndex });
  let path;
  try { path = operation.path; parsePointer(path); } catch (error) {
    if (error instanceof DiffPatchError) { error.operationIndex = operationIndex; throw error; }
    throw error;
  }
  if (path === '' && operation.op !== 'replace') throw new DiffPatchError('INVALID_OPERATION', 'Root add/remove operations are not supported', { path, operationIndex });
  const normalized = { op: operation.op, path, index: operationIndex };
  if (operation.op !== 'remove') {
    const state = { config, nodes: 0 };
    normalized.value = cloneAndValidate(operation.value, state, 0, path);
    if (valueBytes(normalized.value) > config.maxValueBytes) throw new DiffPatchError('VALUE_LIMIT', 'Operation value exceeds the configured serialized size limit', { path, operationIndex, statusCode: 413 });
  }
  return Object.freeze(normalized);
}

function getParent(root, tokens, path, operationIndex) {
  if (tokens.length === 0) return { parent: null, key: null };
  let current = root;
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    if (Array.isArray(current)) {
      if (!/^0$|^[1-9][0-9]*$/.test(token) || Number(token) >= current.length) throw new DiffPatchError('PATH_NOT_FOUND', 'Patch path does not exist', { path, operationIndex });
    } else if (!isPlainObject(current) || !Object.hasOwn(current, token)) {
      throw new DiffPatchError('PATH_NOT_FOUND', 'Patch path does not exist', { path, operationIndex });
    }
    current = current[Array.isArray(current) ? Number(token) : token];
  }
  return { parent: current, key: tokens[tokens.length - 1] };
}

function applyOne(root, operation, config) {
  const tokens = parsePointer(operation.path);
  if (tokens.length === 0) return cloneAndValidate(operation.value, { config, nodes: 0 });

  const parentInfo = getParent(root, tokens, operation.path, operation.index);
  const parent = parentInfo.parent;
  const key = parentInfo.key;
  if (Array.isArray(parent)) {
    if (!/^0$|^[1-9][0-9]*$/.test(key)) throw new DiffPatchError('INVALID_PATH', 'Array paths require non-negative integer indices', { path: operation.path, operationIndex: operation.index });
    const index = Number(key);
    if (operation.op === 'add') {
      if (index > parent.length) throw new DiffPatchError('PATH_NOT_FOUND', 'Array insertion index is out of range', { path: operation.path, operationIndex: operation.index });
      const output = parent.slice(); output.splice(index, 0, operation.value); return Object.freeze(output);
    }
    if (index >= parent.length) throw new DiffPatchError('PATH_NOT_FOUND', 'Array target index is out of range', { path: operation.path, operationIndex: operation.index });
    const output = parent.slice();
    if (operation.op === 'replace') output[index] = operation.value;
    else output.splice(index, 1);
    return Object.freeze(output);
  }

  if (!isPlainObject(parent)) throw new DiffPatchError('PATH_NOT_FOUND', 'Patch parent is not patchable', { path: operation.path, operationIndex: operation.index });
  const output = { ...parent };
  const exists = Object.hasOwn(output, key);
  if (operation.op === 'add') {
    if (exists) throw new DiffPatchError('CONFLICTING_OPERATION', 'Object add target already exists', { path: operation.path, operationIndex: operation.index });
    output[key] = operation.value;
  } else if (operation.op === 'replace') {
    if (!exists) throw new DiffPatchError('PATH_NOT_FOUND', 'Object replace target does not exist', { path: operation.path, operationIndex: operation.index });
    output[key] = operation.value;
  } else {
    if (!exists) throw new DiffPatchError('PATH_NOT_FOUND', 'Object remove target does not exist', { path: operation.path, operationIndex: operation.index });
    delete output[key];
  }
  return Object.freeze(output);
}

export const diff = (before, after, options) => createDiffEngine(options).diff(before, after);
export const applyPatch = (source, operations, options) => createDiffEngine(options).applyPatch(source, operations);
export {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  DEFAULT_MAX_OPERATIONS,
  DEFAULT_MAX_STRING_BYTES,
  DEFAULT_MAX_VALUE_BYTES,
};
