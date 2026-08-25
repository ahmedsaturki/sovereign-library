const DEFAULT_MAX_DEPTH = 20;
const DEFAULT_MAX_NODES = 10_000;
const DEFAULT_MAX_STRING_BYTES = 1_048_576;
const DEFAULT_MAX_OUTPUT_BYTES = 4 * 1_048_576;
const DEFAULT_REPLACEMENT = '[REDACTED]';
const KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const SENSITIVE_KEY_RE = /(^|[_-])(password|passwd|passphrase|secret|token|api[-_]?key|authorization|cookie|credentials?|private[-_]?key|connection[-_]?string|database[-_]?url|dsn)(?:$|[_-])/i;
const SENSITIVE_EXACT_KEYS = new Set([
  'password', 'passwd', 'passphrase', 'secret', 'token', 'authtoken', 'accesstoken', 'refreshtoken', 'idtoken',
  'apikey', 'privatekey', 'authorization', 'cookie', 'set-cookie', 'credential', 'credentials', 'clientsecret',
  'webhooksecret', 'signingsecret', 'sessiontoken', 'databaseurl', 'connectionstring', 'dsn',
]);
const DEFAULT_STRING_RULES = Object.freeze([
  Object.freeze({ pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, replacement: DEFAULT_REPLACEMENT }),
  Object.freeze({ pattern: /\bBasic\s+[A-Za-z0-9+/=]+/gi, replacement: DEFAULT_REPLACEMENT }),
  Object.freeze({ pattern: /-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/g, replacement: DEFAULT_REPLACEMENT }),
]);
const lexicalCompare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export class RedactionError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'RedactionError';
    this.code = code;
    this.path = options.path ?? null;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new RedactionError('INVALID_LIMIT', `${name} must be a safe integer >= 1`);
}

function assertPlainObject(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeStringRules(rules) {
  if (rules === undefined) return DEFAULT_STRING_RULES;
  if (!Array.isArray(rules)) throw new RedactionError('INVALID_RULES', 'stringRules must be an array');
  return Object.freeze(rules.map((rule, index) => {
    if (rule instanceof RegExp) return Object.freeze({ pattern: rule, replacement: DEFAULT_REPLACEMENT });
    if (!rule || !(rule.pattern instanceof RegExp)) throw new RedactionError('INVALID_RULE', `Invalid string rule at index ${index}`);
    const replacement = rule.replacement ?? DEFAULT_REPLACEMENT;
    if (typeof replacement !== 'string') throw new RedactionError('INVALID_RULE', `Replacement at index ${index} must be a string`);
    return Object.freeze({ pattern: rule.pattern, replacement });
  }));
}

function compileKeyRules(sensitiveKeys, keyPatterns) {
  const keys = new Set([...SENSITIVE_EXACT_KEYS]);
  for (const key of sensitiveKeys ?? []) {
    if (typeof key !== 'string' || !KEY_RE.test(key)) throw new RedactionError('INVALID_SENSITIVE_KEY', `Invalid sensitive key: ${String(key)}`);
    keys.add(key.toLowerCase());
  }
  if (keyPatterns !== undefined && !Array.isArray(keyPatterns)) throw new RedactionError('INVALID_RULES', 'keyPatterns must be an array');
  const patterns = Object.freeze((keyPatterns ?? []).map((pattern, index) => {
    if (!(pattern instanceof RegExp)) throw new RedactionError('INVALID_RULE', `Invalid key pattern at index ${index}`);
    return pattern;
  }));
  return Object.freeze({ keys, patterns });
}

function utf8Bytes(value) {
  return Buffer.byteLength(value, 'utf8');
}

function applyStringRules(value, rules) {
  let output = value;
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    output = output.replace(rule.pattern, rule.replacement);
  }
  return output;
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freezeDeep(nested);
    Object.freeze(value);
  }
  return value;
}

export function createRedactor(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new RedactionError('INVALID_OPTIONS', 'Redaction options must be an object');
  const config = Object.freeze({
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxNodes: options.maxNodes ?? DEFAULT_MAX_NODES,
    maxStringBytes: options.maxStringBytes ?? DEFAULT_MAX_STRING_BYTES,
    maxOutputBytes: options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
    replacement: options.replacement ?? DEFAULT_REPLACEMENT,
  });
  assertPositiveInteger(config.maxDepth, 'maxDepth');
  assertPositiveInteger(config.maxNodes, 'maxNodes');
  assertPositiveInteger(config.maxStringBytes, 'maxStringBytes');
  assertPositiveInteger(config.maxOutputBytes, 'maxOutputBytes');
  if (typeof config.replacement !== 'string' || config.replacement.length === 0) throw new RedactionError('INVALID_REPLACEMENT', 'replacement must be a non-empty string');

  const keyRules = compileKeyRules(options.sensitiveKeys, options.keyPatterns);
  const stringRules = normalizeStringRules(options.stringRules);
  const customKeyMatcher = options.keyMatcher;
  if (customKeyMatcher !== undefined && typeof customKeyMatcher !== 'function') throw new RedactionError('INVALID_RULES', 'keyMatcher must be a function');

  function isSensitiveKey(key, path) {
    const normalized = key.toLowerCase();
    if (keyRules.keys.has(normalized) || SENSITIVE_KEY_RE.test(key)) return true;
    for (const pattern of keyRules.patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(key)) return true;
    }
    if (!customKeyMatcher) return false;
    try {
      return Boolean(customKeyMatcher(key, path));
    } catch (cause) {
      throw new RedactionError('CUSTOM_MATCHER_FAILED', 'Custom key matcher failed safely', { cause, path });
    }
  }

  function redactString(value, path = '$') {
    if (typeof value !== 'string') throw new RedactionError('INVALID_STRING', 'redactString expects a string', { path });
    if (utf8Bytes(value) > config.maxStringBytes) throw new RedactionError('STRING_TOO_LARGE', `String exceeds ${config.maxStringBytes} bytes`, { path, statusCode: 413 });
    const output = applyStringRules(value, stringRules);
    if (utf8Bytes(output) > config.maxOutputBytes) throw new RedactionError('OUTPUT_TOO_LARGE', `Redacted output exceeds ${config.maxOutputBytes} bytes`, { path, statusCode: 413 });
    return output;
  }

  function redact(value) {
    return redactWithReport(value).value;
  }

  function redactWithReport(value) {
    const active = new WeakSet();
    const report = { redactedPaths: [], stringMatches: 0, nodesVisited: 0 };

    function visit(current, depth, path) {
      report.nodesVisited += 1;
      if (report.nodesVisited > config.maxNodes) throw new RedactionError('NODE_LIMIT', `Redaction exceeded ${config.maxNodes} nodes`, { path, statusCode: 413 });
      if (depth > config.maxDepth) throw new RedactionError('MAX_DEPTH_EXCEEDED', `Redaction exceeded depth ${config.maxDepth}`, { path, statusCode: 413 });

      if (current === null || typeof current === 'boolean') return current;
      if (typeof current === 'number') {
        if (!Number.isFinite(current)) throw new RedactionError('UNSUPPORTED_VALUE', `Unsupported non-finite number at ${path}`, { path });
        return current;
      }
      if (typeof current === 'string') {
        const before = current;
        const after = redactString(current, path);
        if (before !== after) report.stringMatches += 1;
        return after;
      }
      if (typeof current !== 'object') throw new RedactionError('UNSUPPORTED_VALUE', `Unsupported value at ${path}`, { path });
      if (active.has(current)) throw new RedactionError('CIRCULAR_REFERENCE', `Circular reference detected at ${path}`, { path });
      if (depth === config.maxDepth) throw new RedactionError('MAX_DEPTH_EXCEEDED', `Redaction exceeded depth ${config.maxDepth}`, { path, statusCode: 413 });
      if (!assertPlainObject(current) && !Array.isArray(current)) throw new RedactionError('UNSUPPORTED_OBJECT', `Only plain objects and arrays are supported at ${path}`, { path });

      active.add(current);
      try {
        if (Array.isArray(current)) return current.map((item, index) => visit(item, depth + 1, `${path}[${index}]`));
        const keys = Object.keys(current).sort(lexicalCompare);
        const output = {};
        for (const key of keys) {
          const childPath = `${path}.${key}`;
          if (isSensitiveKey(key, childPath)) {
            Object.defineProperty(output, key, { value: config.replacement, enumerable: true, writable: true, configurable: true });
            report.redactedPaths.push(childPath);
          } else {
            Object.defineProperty(output, key, { value: visit(current[key], depth + 1, childPath), enumerable: true, writable: true, configurable: true });
          }
        }
        return output;
      } finally {
        active.delete(current);
      }
    }

    const redactedValue = visit(value, 0, '$');
    let serialized;
    try {
      serialized = JSON.stringify(redactedValue);
    } catch (cause) {
      throw new RedactionError('OUTPUT_SERIALIZATION_FAILED', 'Redacted output could not be serialized safely', { cause });
    }
    if (utf8Bytes(serialized) > config.maxOutputBytes) throw new RedactionError('OUTPUT_TOO_LARGE', `Redacted output exceeds ${config.maxOutputBytes} bytes`, { statusCode: 413 });
    report.redactedPaths.sort(lexicalCompare);
    return freezeDeep({ value: redactedValue, report: { redactedPaths: [...report.redactedPaths], stringMatches: report.stringMatches, nodesVisited: report.nodesVisited } });
  }

  return Object.freeze({
    config,
    redact,
    redactString,
    redactWithReport,
    isSensitiveKey,
  });
}

export {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  DEFAULT_MAX_STRING_BYTES,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_REPLACEMENT,
  SENSITIVE_EXACT_KEYS,
};
