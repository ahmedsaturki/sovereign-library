import { createHash } from 'node:crypto';

const FORMAT = 'GPM1';
const MAX_PATTERN = 4096;
const MAX_PATH = 32768;
const MAX_SEGMENTS = 1024;
const MAX_TOKENS = 8192;
const MAX_RULES = 4096;
const MAX_SERIALIZED = 256 * 1024;

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export class GlobPathMatcherError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GlobPathMatcherError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new GlobPathMatcherError(code, message);
}

function validatePlain(value, label, seen = new Set(), depth = 0) {
  if (depth > 16) fail('DEPTH_LIMIT', `${label} exceeds maximum depth`);
  if (value === null) return;
  const type = typeof value;
  if (type === 'function' || type === 'symbol' || type === 'bigint' || type === 'undefined') {
    fail('UNSUPPORTED_VALUE', `${label} contains an unsupported value`);
  }
  if (type === 'number' && !Number.isFinite(value)) fail('UNSUPPORTED_VALUE', `${label} contains a non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null && !Array.isArray(value)) fail('UNSUPPORTED_VALUE', `${label} must be plain data`);
  seen.add(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    validatePlain(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function clone(value) {
  validatePlain(value, 'value');
  return JSON.parse(JSON.stringify(value));
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function normalizeOptions(options = {}) {
  validatePlain(options, 'options');
  const normalized = {
    caseMode: options.caseMode ?? 'sensitive',
    dotfiles: options.dotfiles ?? 'include',
    escape: options.escape ?? true,
    separatorNormalization: options.separatorNormalization ?? true,
    normalizeDotSegments: options.normalizeDotSegments ?? false,
    allowRelativeAgainstRoot: options.allowRelativeAgainstRoot ?? false,
  };
  if (!['sensitive', 'insensitive'].includes(normalized.caseMode)) fail('INVALID_OPTION', 'caseMode must be sensitive or insensitive');
  if (!['include', 'exclude'].includes(normalized.dotfiles)) fail('INVALID_OPTION', 'dotfiles must be include or exclude');
  for (const key of ['escape', 'separatorNormalization', 'normalizeDotSegments', 'allowRelativeAgainstRoot']) {
    if (typeof normalized[key] !== 'boolean') fail('INVALID_OPTION', `${key} must be boolean`);
  }
  return normalized;
}

function fold(value, caseMode) {
  return caseMode === 'insensitive' ? value.toLocaleLowerCase('en-US') : value;
}

function pathKind(path) {
  if (/^[A-Za-z]:\//.test(path)) return { absolute: true, root: path.slice(0, 3) };
  if (path.startsWith('//')) return { absolute: true, root: '//' };
  if (path.startsWith('/')) return { absolute: true, root: '/' };
  return { absolute: false, root: '' };
}

function normalizePath(path, options = {}) {
  if (typeof path !== 'string') fail('INVALID_PATH', 'path must be a string');
  if (path.length > MAX_PATH) fail('LIMIT_EXCEEDED', `path exceeds ${MAX_PATH} characters`);
  const opts = normalizeOptions(options);
  let value = opts.separatorNormalization ? path.replaceAll('\\', '/') : path;
  const kind = pathKind(value);
  const prefix = kind.root;
  const rest = kind.absolute ? value.slice(prefix.length) : value;
  if (opts.separatorNormalization && rest.includes('//')) fail('INVALID_PATH', 'repeated path separators are not allowed');
  const rawSegments = rest.split('/').filter((segment, index) => !(segment === '' && index === 0));
  if (rawSegments.length > MAX_SEGMENTS) fail('LIMIT_EXCEEDED', `path exceeds ${MAX_SEGMENTS} segments`);
  const segments = [];
  for (const segment of rawSegments) {
    if (segment === '.') {
      if (opts.normalizeDotSegments) continue;
      segments.push(segment);
      continue;
    }
    if (segment === '..') {
      if (!opts.normalizeDotSegments) {
        segments.push(segment);
        continue;
      }
      if (segments.length && segments.at(-1) !== '..') {
        segments.pop();
        continue;
      }
      if (kind.absolute) fail('TRAVERSAL_ESCAPE', 'path escapes its absolute root');
      fail('TRAVERSAL_ESCAPE', 'relative path escapes its root scope');
    }
    segments.push(segment);
  }
  const body = segments.join('/');
  if (!body) return prefix || (kind.absolute ? '/' : '');
  if (kind.absolute) return prefix + body;
  return body;
}

function splitPattern(pattern, options) {
  if (typeof pattern !== 'string') fail('INVALID_PATTERN', 'pattern must be a string');
  if (pattern.length === 0) fail('INVALID_PATTERN', 'pattern must not be empty');
  if (pattern.length > MAX_PATTERN) fail('LIMIT_EXCEEDED', `pattern exceeds ${MAX_PATTERN} characters`);
  const opts = normalizeOptions(options);
  let value = opts.separatorNormalization ? pattern.replaceAll('\\', '/') : pattern;
  const kind = pathKind(value);
  const prefix = kind.root;
  const rest = kind.absolute ? value.slice(prefix.length) : value;
  if (opts.separatorNormalization && rest.includes('//')) fail('INVALID_PATTERN', 'repeated separators are not allowed');
  if (rest.startsWith('..') && (rest === '..' || rest.startsWith('../'))) fail('TRAVERSAL_ESCAPE', 'pattern escapes its root scope');
  const rawSegments = rest.split('/').filter((segment, index) => !(segment === '' && index === 0));
  if (rawSegments.length > MAX_SEGMENTS) fail('LIMIT_EXCEEDED', `pattern exceeds ${MAX_SEGMENTS} segments`);
  return { absolute: kind.absolute, root: prefix, segments: rawSegments, options: opts };
}

function tokenizeSegment(segment, options) {
  const tokens = [];
  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    if (options.escape && char === '\\') {
      index += 1;
      if (index >= segment.length) fail('INVALID_ESCAPE', 'terminal escape is incomplete');
      tokens.push({ type: 'literal', value: segment[index] });
      continue;
    }
    if (char === '*') tokens.push({ type: 'star' });
    else if (char === '?') tokens.push({ type: 'question' });
    else tokens.push({ type: 'literal', value: char });
  }
  return tokens;
}

function segmentMatch(tokens, value, caseMode) {
  const text = fold(value, caseMode);
  const literals = tokens.map(token => token.type === 'literal' ? { ...token, value: fold(token.value, caseMode) } : token);
  let current = new Set([0]);
  for (let i = 0; i < current.size + text.length + tokens.length; i += 1) {
    const closure = new Set(current);
    let changed = true;
    while (changed) {
      changed = false;
      for (const position of [...closure]) {
        if (position < literals.length && literals[position].type === 'star' && !closure.has(position + 1)) {
          closure.add(position + 1);
          changed = true;
        }
      }
    }
    current = closure;
    if (!text.length) break;
    const char = text[0];
    const next = new Set();
    for (const position of current) {
      const token = literals[position];
      if (!token) continue;
      if (token.type === 'star') next.add(position);
      else if (token.type === 'question' || token.value === char) next.add(position + 1);
    }
    return segmentMatchFrom(tokens, text, caseMode, 0, current);
  }
  return current.has(literals.length);
}

function segmentMatchFrom(tokens, text, caseMode) {
  const foldedTokens = tokens.map(token => token.type === 'literal' ? { ...token, value: fold(token.value, caseMode) } : token);
  let states = new Set([0]);
  const epsilon = (input) => {
    const out = new Set(input);
    let changed = true;
    while (changed) {
      changed = false;
      for (const pos of [...out]) {
        if (pos < foldedTokens.length && foldedTokens[pos].type === 'star' && !out.has(pos + 1)) {
          out.add(pos + 1);
          changed = true;
        }
      }
    }
    return out;
  };
  states = epsilon(states);
  for (const char of text) {
    const next = new Set();
    for (const pos of states) {
      const token = foldedTokens[pos];
      if (!token) continue;
      if (token.type === 'star') next.add(pos);
      else if (token.type === 'question' || token.value === char) next.add(pos + 1);
    }
    states = epsilon(next);
    if (!states.size) return false;
  }
  return epsilon(states).has(foldedTokens.length);
}

function pathSegments(path, options) {
  const normalized = normalizePath(path, options);
  const kind = pathKind(normalized);
  const root = kind.root;
  const body = kind.absolute ? normalized.slice(root.length) : normalized;
  const segments = body ? body.split('/') : [];
  return { normalized, absolute: kind.absolute, root, segments };
}

function compiledMatcher(patternInfo) {
  const tokens = patternInfo.segments.map(segment => segment === '**' ? Object.freeze({ recursive: true }) : Object.freeze({ recursive: false, tokens: tokenizeSegment(segment, patternInfo.options) }));
  const totalTokens = tokens.reduce((sum, token) => sum + (token.recursive ? 1 : token.tokens.length), 0);
  if (totalTokens > MAX_TOKENS) fail('LIMIT_EXCEEDED', `compiled token count exceeds ${MAX_TOKENS}`);
  return freezeDeep({
    format: FORMAT,
    version: 1,
    pattern: patternInfo.root + patternInfo.segments.join('/'),
    absolute: patternInfo.absolute,
    root: patternInfo.root,
    options: clone(patternInfo.options),
    segments: tokens,
  });
}

export function compileGlob(pattern, options = {}) {
  return compiledMatcher(splitPattern(pattern, options));
}

export function normalizeCandidatePath(path, options = {}) {
  return normalizePath(path, options);
}

export function matchGlob(compiled, candidatePath, overrideOptions = {}) {
  validatePlain(compiled, 'compiled');
  if (compiled?.format !== FORMAT || compiled?.version !== 1 || !Array.isArray(compiled.segments)) fail('INVALID_MATCHER', 'compiled matcher is invalid');
  const options = normalizeOptions({ ...compiled.options, ...overrideOptions });
  const candidate = pathSegments(candidatePath, options);
  if (compiled.absolute !== candidate.absolute && !options.allowRelativeAgainstRoot) return false;
  if (candidate.segments.some(segment => segment.startsWith('.') && options.dotfiles === 'exclude')) return false;

  const patternSegments = compiled.segments;
  const memo = new Map();
  const visit = (p, c) => {
    const key = `${p}:${c}`;
    if (memo.has(key)) return memo.get(key);
    let result = false;
    if (p === patternSegments.length) result = c === candidate.segments.length;
    else {
      const token = patternSegments[p];
      if (token.recursive) {
        result = visit(p + 1, c) || (c < candidate.segments.length && visit(p, c + 1));
      } else if (c < candidate.segments.length) {
        result = segmentMatchFrom(token.tokens, fold(candidate.segments[c], options.caseMode), options.caseMode) && visit(p + 1, c + 1);
      }
    }
    memo.set(key, result);
    return result;
  };
  return visit(0, 0);
}

export function evaluateRules(rules, candidatePath, options = {}) {
  validatePlain(rules, 'rules');
  if (!Array.isArray(rules) || rules.length > MAX_RULES) fail('LIMIT_EXCEEDED', `rules must contain at most ${MAX_RULES} items`);
  const opts = { firstMatchWins: false, defaultAction: 'exclude', ...options };
  validatePlain(opts, 'ruleOptions');
  if (!['include', 'exclude'].includes(opts.defaultAction) || typeof opts.firstMatchWins !== 'boolean') fail('INVALID_OPTION', 'invalid rule options');
  const compiled = [];
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    if (!rule || typeof rule.pattern !== 'string' || !['include', 'exclude'].includes(rule.action)) fail('INVALID_RULE', `rule ${index} is invalid`);
    compiled.push({ index, action: rule.action, matcher: compileGlob(rule.pattern, rule.options ?? {}) });
  }
  let winner = null;
  for (const rule of compiled) {
    if (!matchGlob(rule.matcher, candidatePath)) continue;
    winner = rule;
    if (opts.firstMatchWins) break;
  }
  return Object.freeze({
    matched: winner !== null,
    action: winner?.action ?? opts.defaultAction,
    ruleIndex: winner?.index ?? null,
  });
}

function canonicalPayload(value) {
  validatePlain(value, 'payload');
  return JSON.stringify(value, (_, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
    return item;
  });
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function serializePattern(compiled) {
  validatePlain(compiled, 'compiled');
  if (compiled?.format !== FORMAT || compiled?.version !== 1) fail('INVALID_MATCHER', 'compiled matcher is invalid');
  const payload = canonicalPayload(compiled);
  if (Buffer.byteLength(payload, 'utf8') > MAX_SERIALIZED) fail('LIMIT_EXCEEDED', `serialized matcher exceeds ${MAX_SERIALIZED} bytes`);
  return canonicalPayload({ format: FORMAT, checksum: sha256(payload), payload });
}

export function parsePattern(serialized) {
  if (typeof serialized !== 'string' || serialized.length === 0) fail('MALFORMED_SERIALIZATION', 'serialized matcher must be a non-empty string');
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED) fail('LIMIT_EXCEEDED', `serialized matcher exceeds ${MAX_SERIALIZED} bytes`);
  let envelope;
  try { envelope = JSON.parse(serialized); } catch { fail('MALFORMED_SERIALIZATION', 'serialized matcher is invalid JSON'); }
  validatePlain(envelope, 'envelope');
  if (envelope.format !== FORMAT || typeof envelope.payload !== 'string' || !/^[0-9a-f]{64}$/.test(envelope.checksum)) fail('MALFORMED_SERIALIZATION', 'serialized matcher envelope is invalid');
  if (sha256(envelope.payload) !== envelope.checksum) fail('INTEGRITY_MISMATCH', 'serialized matcher checksum mismatch');
  let payload;
  try { payload = JSON.parse(envelope.payload); } catch { fail('MALFORMED_SERIALIZATION', 'matcher payload is invalid JSON'); }
  validatePlain(payload, 'matcherPayload');
  if (payload.format !== FORMAT || payload.version !== 1) fail('UNSUPPORTED_VERSION', 'unsupported matcher format/version');
  return freezeDeep(payload);
}

export const GLOB_PATH_MATCHER_FORMAT = FORMAT;
export const GLOB_PATH_MATCHER_LIMITS = Object.freeze({
  MAX_PATTERN,
  MAX_PATH,
  MAX_SEGMENTS,
  MAX_TOKENS,
  MAX_RULES,
  MAX_SERIALIZED,
});
