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

function fail(code, message, options = {}) {
  throw new DiffPatchError(code, message, options);
}

function assertPositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_LIMIT', `${name} must be a safe integer >= 1`);
}

function isPlainObject(value) {
  if (!isObject(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function utf8Bytes(value) { return Buffer.byteLength(value, 'utf8'); }

function escapeToken(token) { return token.replaceAll('~', '~0').replaceAll('/', '~1'); }

function unescapeToken(token) {
  if (/~(?![01])/.test(token)) fail('INVALID_PATH', 'Path contains an invalid escape sequence');
  return token.replaceAll('~1', '/').replaceAll('~0', '~');
}

function parsePointer(path) {
  if (typeof path !== 'string' || path.length > 65536) fail('INVALID_PATH', 'Path must be a bounded string');
  if (path === '') return [];
  if (!path.startsWith('/')) fail('INVALID_PATH', 'Path must be empty or start with /');
  return path.slice(1).split('/').map(unescapeToken);
}

function formatPath(parent, token) { return `${parent}/${escapeToken(token)}`; }

function cloneAndValidate(value, state, depth = 0, path = '') {
  state.nodes += 1;
  if (state.nodes > state.config.maxNodes) fail('NODE_LIMIT', 'Value exceeds the configured node limit', { path, statusCode: 413 });
  if (depth > state.config.maxDepth) fail('DEPTH_LIMIT', 'Value exceeds the configured depth limit', { path, statusCode: 413 });

  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('UNSUPPORTED_VALUE', 'Only finite numbers are supported', { path });
    return value;
  }
  if (typeof value === 'string') {
    if (utf8Bytes(value) > state.config.maxStringBytes) fail('STRING_LIMIT', 'String exceeds the configured size limit', { path, statusCode: 413 });
    return value;
  }
  if (!isObject(value)) fail('UNSUPPORTED_VALUE', 'Unsupported value type', { path });
  if (!Array.isArray(value) && !isPlainObject(value)) fail('UNSUPPORTED_OBJECT', 'Only arrays and plain objects are supported', { path });

  if (Array.isArray(value)) {
    const output = value.map((item, index) => cloneAndValidate(item, state, depth + 1, `${path}/${index}`));
    return Object.freeze(output);
  }

  const output = {};
  for (const key of Object.keys(value).sort(compare)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('UNSUPPORTED_OBJECT', 'Accessor properties are not supported', { path: formatPath(path, key) });
    output[key] = cloneAndValidate(descriptor.value, state, depth + 1, formatPath(path, key));
  }
  return Object.freeze(output);
}

function valueBytes(value) {
  let serialized;
  try { serialized = JSON.stringify(value); } catch (cause) { fail('SERIALIZATION_FAILED', 'Value could not be serialized safely', { cause }); }
  return utf8Bytes(serialized);
}

function freezeOperation(operation) { return Object.freeze(operation); }

export function createDiffEngine(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) fail('INVALID_OPTIONS', 'Options must be an object');
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
    if (valueBytes(clone) > config.maxValueBytes) fail('VALUE_LIMIT', 'Value exceeds the configured serialized size limit', { statusCode: 413 });
    return clone;
  }

  function diff(before, after) {
    const left = validateRoot(before);
    const right = validateRoot(after);
    const operations = [];
    const addOperation = (operation) => {
      if (operations.length >= config.maxOperations) fail('OPERATION_LIMIT', 'Diff exceeds the configured operation limit', { path: operation.path, statusCode: 413 });
      operations.push(freezeOperation(operation));
    };

    function walk(a, b, path, depth) {
      if (depth > config.maxDepth) fail('DEPTH_LIMIT', 'Diff exceeds the configured depth limit', { path, statusCode: 413 });
      if (Object.is(a, b)) return;
      const arrays = Array.isArray(a) && Array.isArray(b);
      const objects = isPlainObject(a) && isPlainObject(b);
      if (!arrays && !objects) { addOperation({ op: 'replace', path, value: b }); return; }

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
    let output = validateRoot(source);
    if (!Array.isArray(operations)) fail('INVALID_OPERATIONS', 'Operations must be an array');
    if (operations.length > config.maxOperations) fail('OPERATION_LIMIT', 'Patch exceeds the configured operation limit', { statusCode: 413 });

    const normalized = operations.map((operation, operationIndex) => normalizeOperation(operation, operationIndex, config));
    const seenPaths = new Set();
    for (const operation of normalized) {
      if (seenPaths.has(operation.path)) fail('CONFLICTING_OPERATION', 'Duplicate operation path is not allowed', { path: operation.path, operationIndex: operation.index });
      seenPaths.add(operation.path);
    }
    for (const operation of normalized) output = applyOne(output, operation, config);
    if (valueBytes(output) > config.maxValueBytes) fail('VALUE_LIMIT', 'Patched value exceeds the configured serialized size limit', { statusCode: 413 });
    return output;
  }

  return Object.freeze({ config, diff, applyPatch });
}

function normalizeOperation(operation, operationIndex, config) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) fail('INVALID_OPERATION', 'Operation must be an object', { operationIndex });
  const allowed = operation.op === 'remove' ? ['op', 'path'] : ['op', 'path', 'value'];
  for (const key of Object.keys(operation)) if (!allowed.includes(key)) fail('INVALID_OPERATION', 'Operation contains an unknown member', { operationIndex });
  if (!['add', 'remove', 'replace'].includes(operation.op)) fail('INVALID_OPERATION', 'Operation type is unsupported', { operationIndex });
  const path = operation.path;
  try { parsePointer(path); } catch (error) {
    if (error instanceof DiffPatchError) throw new DiffPatchError(error.code, error.message, { path: null, operationIndex, statusCode: error.statusCode });
    throw error;
  }
  if (path === '' && operation.op !== 'replace') fail('INVALID_OPERATION', 'Root add/remove operations are not supported', { path, operationIndex });
  const normalized = { op: operation.op, path, index: operationIndex };
  if (operation.op !== 'remove') {
    const state = { config, nodes: 0 };
    normalized.value = cloneAndValidate(operation.value, state, 0, path);
    if (valueBytes(normalized.value) > config.maxValueBytes) fail('VALUE_LIMIT', 'Operation value exceeds the configured serialized size limit', { path, operationIndex, statusCode: 413 });
  }
  return Object.freeze(normalized);
}

function getChild(container, token, path, operationIndex) {
  if (Array.isArray(container)) {
    if (!/^0$|^[1-9][0-9]*$/.test(token) || Number(token) >= container.length) fail('PATH_NOT_FOUND', 'Patch path does not exist', { path, operationIndex });
    return container[Number(token)];
  }
  if (!isPlainObject(container) || !Object.hasOwn(container, token)) fail('PATH_NOT_FOUND', 'Patch path does not exist', { path, operationIndex });
  return container[token];
}

function rebuildAt(root, tokens, operation, depth = 0) {
  const { path, index: operationIndex } = operation;
  if (depth >= tokens.length) {
    if (operation.op === 'replace') return operation.value;
    fail('INVALID_OPERATION', 'Root add/remove operations are not supported', { path, operationIndex });
  }

  const token = tokens[depth];
  if (depth === tokens.length - 1) {
    if (Array.isArray(root)) {
      if (!/^0$|^[1-9][0-9]*$/.test(token)) fail('INVALID_PATH', 'Array paths require non-negative integer indices', { path, operationIndex });
      const index = Number(token);
      const output = root.slice();
      if (operation.op === 'add') {
        if (index > output.length) fail('PATH_NOT_FOUND', 'Array insertion index is out of range', { path, operationIndex });
        output.splice(index, 0, operation.value);
      } else {
        if (index >= output.length) fail('PATH_NOT_FOUND', 'Array target index is out of range', { path, operationIndex });
        if (operation.op === 'replace') output[index] = operation.value;
        else output.splice(index, 1);
      }
      return Object.freeze(output);
    }
    if (!isPlainObject(root)) fail('PATH_NOT_FOUND', 'Patch parent is not patchable', { path, operationIndex });
    const output = { ...root };
    const exists = Object.hasOwn(output, token);
    if (operation.op === 'add') {
      if (exists) fail('CONFLICTING_OPERATION', 'Object add target already exists', { path, operationIndex });
      output[token] = operation.value;
    } else if (operation.op === 'replace') {
      if (!exists) fail('PATH_NOT_FOUND', 'Object replace target does not exist', { path, operationIndex });
      output[token] = operation.value;
    } else {
      if (!exists) fail('PATH_NOT_FOUND', 'Object remove target does not exist', { path, operationIndex });
      delete output[token];
    }
    return Object.freeze(Object.fromEntries(Object.keys(output).sort(compare).map((key) => [key, output[key]])));
  }

  const child = getChild(root, token, path, operationIndex);
  const updatedChild = rebuildAt(child, tokens, operation, depth + 1);
  if (Array.isArray(root)) {
    const index = Number(token);
    const output = root.slice(); output[index] = updatedChild; return Object.freeze(output);
  }
  const output = { ...root, [token]: updatedChild };
  return Object.freeze(Object.fromEntries(Object.keys(output).sort(compare).map((key) => [key, output[key]])));
}

function applyOne(root, operation, config) {
  const tokens = parsePointer(operation.path);
  if (tokens.length === 0) return cloneAndValidate(operation.value, { config, nodes: 0 });
  return rebuildAt(root, tokens, operation);
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
