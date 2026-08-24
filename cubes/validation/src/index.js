export class ValidationError extends Error {
  constructor(issues) {
    super(`validation failed with ${issues.length} issue(s)`);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_FAILED';
    this.issues = Object.freeze(issues.slice());
  }
}

const TYPES = new Set(['string', 'number', 'integer', 'boolean', 'bigint', 'object', 'array', 'null', 'any']);

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value) || Object.isFrozen(value)) return value;
  seen.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value)) freeze(item, seen);
  return Object.freeze(value);
}

function issue(path, code, message, details = {}) {
  return Object.freeze({ path: path || '$', code, message, ...details });
}

function pathJoin(path, key) {
  return key === '' ? `${path}[]` : `${path}.${key}`;
}

function coerceValue(value, type) {
  if (typeof value !== 'string') return value;
  if (type === 'boolean') {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
  }
  if (type === 'integer' && /^-?\d+$/.test(value.trim())) return Number(value);
  if (type === 'number' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  if (type === 'bigint' && /^-?\d+$/.test(value.trim())) return BigInt(value);
  return value;
}

function validateNode(schema, value, path, issues, options) {
  if (value === undefined) {
    if (schema.required) issues.push(issue(path, 'REQUIRED', 'value is required'));
    else if (Object.hasOwn(schema, 'default')) return schema.default;
    return value;
  }

  let current = options.coerce ? coerceValue(value, schema.type) : value;
  const actualType = current === null ? 'null' : Array.isArray(current) ? 'array' : typeof current;
  const expected = schema.type;

  if (expected && expected !== 'any' && actualType !== expected) {
    issues.push(issue(path, 'TYPE', `expected ${expected}, received ${actualType}`, { expected, received: actualType }));
    return undefined;
  }

  if (schema.literal !== undefined && !Object.is(current, schema.literal)) {
    issues.push(issue(path, 'LITERAL', 'value does not match literal', { expected: schema.literal }));
  }
  if (schema.enum && !schema.enum.some(item => Object.is(item, current))) {
    issues.push(issue(path, 'ENUM', 'value is not an allowed option', { allowed: schema.enum }));
  }

  if (expected === 'string') {
    if (schema.minLength !== undefined && current.length < schema.minLength) issues.push(issue(path, 'MIN_LENGTH', `string length must be >= ${schema.minLength}`));
    if (schema.maxLength !== undefined && current.length > schema.maxLength) issues.push(issue(path, 'MAX_LENGTH', `string length must be <= ${schema.maxLength}`));
    if (schema.pattern && !schema.pattern.test(current)) issues.push(issue(path, 'PATTERN', 'string does not match pattern'));
  }

  if (expected === 'number' || expected === 'integer' || expected === 'bigint') {
    if (schema.min !== undefined && current < schema.min) issues.push(issue(path, 'MIN', `value must be >= ${schema.min}`));
    if (schema.max !== undefined && current > schema.max) issues.push(issue(path, 'MAX', `value must be <= ${schema.max}`));
  }

  if (expected === 'array') {
    if (schema.minItems !== undefined && current.length < schema.minItems) issues.push(issue(path, 'MIN_ITEMS', `array length must be >= ${schema.minItems}`));
    if (schema.maxItems !== undefined && current.length > schema.maxItems) issues.push(issue(path, 'MAX_ITEMS', `array length must be <= ${schema.maxItems}`));
    if (schema.items) {
      const out = [];
      for (let index = 0; index < current.length; index += 1) {
        const childValue = validateNode(schema.items, current[index], `${path}[${index}]`, issues, options);
        if (childValue !== undefined) out[index] = childValue;
      }
      current = out;
    }
  }

  if (expected === 'object') {
    if (!current || Object.getPrototypeOf(current) !== Object.prototype) {
      issues.push(issue(path, 'OBJECT', 'expected a plain object'));
      return undefined;
    }

    const shape = schema.shape || {};
    const out = {};
    for (const [key, child] of Object.entries(shape)) {
      const childValue = validateNode(child, current[key], pathJoin(path, key), issues, options);
      if (childValue !== undefined) out[key] = childValue;
    }

    const unknown = Object.keys(current).filter(key => !Object.hasOwn(shape, key));
    const policy = schema.unknownKeys ?? 'preserve';
    if (!['error', 'strip', 'preserve'].includes(policy)) {
      issues.push(issue(path, 'INVALID_UNKNOWN_POLICY', 'unknownKeys must be error, strip, or preserve'));
    } else if (unknown.length && policy === 'error') {
      for (const key of unknown) issues.push(issue(pathJoin(path, key), 'UNKNOWN_KEY', 'unknown key is not allowed'));
    }

    if (policy !== 'strip') {
      for (const key of unknown) out[key] = current[key];
    }
    current = out;
  }

  if (typeof schema.validate === 'function') {
    const result = schema.validate(current, { path });
    if (result !== true && result !== undefined) {
      const message = typeof result === 'string' ? result : 'custom validation failed';
      issues.push(issue(path, 'CUSTOM', message));
    }
  }

  return current;
}

function validateDefinition(definition) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new TypeError('schema definition must be an object');
  if (definition.type && !TYPES.has(definition.type)) throw new TypeError(`unsupported validation type: ${definition.type}`);
  if (definition.type === 'array' && definition.items instanceof Schema === false && definition.items !== undefined) validateDefinition(definition.items);
  if (definition.type === 'object' && definition.shape) {
    if (typeof definition.shape !== 'object' || Array.isArray(definition.shape)) throw new TypeError('object shape must be an object');
    for (const child of Object.values(definition.shape)) {
      if (child instanceof Schema) continue;
      validateDefinition(child);
    }
  }
}

export class Schema {
  constructor(definition) {
    validateDefinition(definition);
    this.definition = freeze(definition);
    Object.freeze(this);
  }

  safeParse(value, options = {}) {
    const issues = [];
    const data = validateNode(this.definition, value, '$', issues, { coerce: options.coerce === true });
    return issues.length
      ? Object.freeze({ success: false, data: undefined, issues: Object.freeze(issues) })
      : Object.freeze({ success: true, data, issues: Object.freeze([]) });
  }

  parse(value, options = {}) {
    const result = this.safeParse(value, options);
    if (!result.success) throw new ValidationError(result.issues);
    return result.data;
  }
}

function normalizeSchema(value) {
  return value instanceof Schema ? value.definition : value;
}

export function schema(definition) {
  return new Schema(definition);
}

export const validators = Object.freeze({
  string: options => schema({ type: 'string', ...(options ?? {}) }),
  number: options => schema({ type: 'number', ...(options ?? {}) }),
  integer: options => schema({ type: 'integer', ...(options ?? {}) }),
  boolean: options => schema({ type: 'boolean', ...(options ?? {}) }),
  array: (items, options = {}) => schema({ type: 'array', items: normalizeSchema(items), ...options }),
  object: (shape, options = {}) => schema({ type: 'object', shape: Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, normalizeSchema(value)])), ...options }),
  literal: value => schema({ type: 'any', literal: value })
});

export { TYPES };
