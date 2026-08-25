import crypto from 'node:crypto';

export const MAX_RULES = 512;
export const MAX_ARTIFACTS = 4096;
export const MAX_FINDINGS = 4096;
export const MAX_STRING = 4096;
export const MAX_METADATA_DEPTH = 8;
export const MAX_METADATA_NODES = 2048;
export const MAX_REGEX_LENGTH = 256;

const SEVERITY_RANK = Object.freeze({ critical: 0, high: 1, medium: 2, low: 3, info: 4 });
const CATEGORIES = new Set(['identity', 'digest', 'version', 'lifecycle', 'lineage', 'metadata', 'constraint']);
const OPERATORS = new Set(['equals', 'notEquals', 'in', 'notIn', 'matches', 'gte', 'gt', 'lte', 'lt', 'exists']);

export class ComplianceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ComplianceError';
    this.code = code;
    Object.freeze(this);
  }
}

function fail(code, message) { throw new ComplianceError(code, message); }

function assertPlainRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', `${label} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !('value' in d)) fail('ACCESSOR_INPUT', `${label} contains an accessor property`);
    if (typeof key !== 'string') fail('INVALID_INPUT', `${label} has an unsupported key type`);
  }
}

function scanSafe(value, seen, depth, nodes, label = 'input') {
  if (depth > MAX_METADATA_DEPTH) fail('BOUNDS', `${label} exceeds max depth`);
  if (value === null || typeof value !== 'object') return nodes + 1;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  seen.add(value);
  let count = nodes + 1;
  assertPlainRecord(value, label);
  for (const child of Object.values(value)) count = scanSafe(child, seen, depth + 1, count, label);
  seen.delete(value);
  if (count > MAX_METADATA_NODES) fail('BOUNDS', `${label} exceeds max nodes`);
  return count;
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.length > MAX_STRING) fail('INVALID_INPUT', `${label} must be a bounded string`);
}

function clone(value) {
  return structuredClone(value);
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])]));
  }
  return value;
}

function safeRegex(pattern) {
  assertString(pattern, 'regex pattern');
  if (pattern.length > MAX_REGEX_LENGTH) fail('INVALID_REGEX', 'regex pattern exceeds the safety bound');
  if (/\([^)]*[+*][^)]*\)[+*]/.test(pattern)) fail('INVALID_REGEX', 'regex pattern contains a potentially explosive nested quantifier');
  try { return new RegExp(pattern, 'u'); } catch { fail('INVALID_REGEX', 'regex pattern is invalid'); }
}

function normalizeRule(input) {
  assertPlainRecord(input, 'rule');
  scanSafe(input, new Set(), 0, 0, 'rule');
  assertString(input.id, 'rule.id');
  if (!/^[-A-Za-z0-9_.:]+$/.test(input.id)) fail('INVALID_RULE', 'rule.id has invalid characters');
  assertString(input.category, 'rule.category');
  if (!CATEGORIES.has(input.category)) fail('INVALID_RULE', 'unsupported rule category');
  assertString(input.severity, 'rule.severity');
  if (!(input.severity in SEVERITY_RANK)) fail('INVALID_RULE', 'unsupported rule severity');
  assertString(input.field, 'rule.field');
  assertString(input.operator, 'rule.operator');
  if (!OPERATORS.has(input.operator)) fail('INVALID_RULE', 'unsupported operator');
  if (input.operator === 'matches') safeRegex(input.value);
  if (input.operator === 'in' || input.operator === 'notIn') {
    if (!Array.isArray(input.value) || input.value.length > 256) fail('INVALID_RULE', 'membership value must be a bounded array');
  }
  return stable(clone(input));
}

function normalizeRules(rules) {
  if (!Array.isArray(rules) || rules.length > MAX_RULES) fail('BOUNDS', 'rules exceed the configured limit');
  const seen = new Set();
  const out = [];
  for (const rule of rules) {
    const normalized = normalizeRule(rule);
    if (seen.has(normalized.id)) fail('DUPLICATE_RULE', `duplicate rule id: ${normalized.id}`);
    seen.add(normalized.id);
    out.push(normalized);
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function normalizeArtifacts(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length > MAX_ARTIFACTS) fail('BOUNDS', 'artifacts exceed the configured limit');
  const seen = new Set();
  const out = [];
  for (const artifact of artifacts) {
    assertPlainRecord(artifact, 'artifact');
    scanSafe(artifact, new Set(), 0, 0, 'artifact');
    assertString(artifact.id, 'artifact.id');
    if (seen.has(artifact.id)) fail('DUPLICATE_ARTIFACT', `duplicate artifact id: ${artifact.id}`);
    seen.add(artifact.id);
    out.push(stable(clone(artifact)));
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function readField(artifact, path) {
  const parts = path.split('.');
  let cur = artifact;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return { exists: false, value: undefined };
    if (!Object.prototype.hasOwnProperty.call(cur, part)) return { exists: false, value: undefined };
    cur = cur[part];
  }
  return { exists: true, value: cur };
}

function evaluate(operator, actual, expected, exists) {
  switch (operator) {
    case 'exists': return exists === Boolean(expected);
    case 'equals': return exists && Object.is(actual, expected);
    case 'notEquals': return !exists || !Object.is(actual, expected);
    case 'in': return exists && Array.isArray(expected) && expected.some((v) => Object.is(v, actual));
    case 'notIn': return !exists || (Array.isArray(expected) && expected.every((v) => !Object.is(v, actual)));
    case 'matches': return exists && typeof actual === 'string' && safeRegex(expected).test(actual);
    case 'gte': return exists && typeof actual === 'number' && actual >= expected;
    case 'gt': return exists && typeof actual === 'number' && actual > expected;
    case 'lte': return exists && typeof actual === 'number' && actual <= expected;
    case 'lt': return exists && typeof actual === 'number' && actual < expected;
    default: fail('INVALID_RULE', `unsupported operator: ${operator}`);
  }
}

function violation(rule, artifact, actual, exists) {
  return {
    ruleId: rule.id,
    artifactId: artifact.id,
    category: rule.category,
    severity: rule.severity,
    field: rule.field,
    expected: clone(rule.value),
    actual: exists ? clone(actual) : null,
    reason: exists ? 'predicate_failed' : 'field_missing',
  };
}

export function normalizePolicies(rules) {
  return freezeDeep(normalizeRules(rules));
}

export function evaluateCompliance(artifacts, rules, options = {}) {
  const normalizedArtifacts = normalizeArtifacts(artifacts);
  const normalizedRules = normalizeRules(rules);
  const maxFindings = options.maxFindings ?? MAX_FINDINGS;
  if (!Number.isInteger(maxFindings) || maxFindings < 0 || maxFindings > MAX_FINDINGS) fail('INVALID_LIMIT', 'maxFindings is invalid');

  const findings = [];
  for (const artifact of normalizedArtifacts) {
    for (const rule of normalizedRules) {
      const { exists, value } = readField(artifact, rule.field);
      if (!evaluate(rule.operator, value, rule.value, exists)) {
        findings.push(violation(rule, artifact, value, exists));
        if (findings.length > maxFindings) fail('BOUNDS', 'compliance findings exceed the configured limit');
      }
    }
  }

  findings.sort((a, b) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    a.category.localeCompare(b.category) ||
    a.ruleId.localeCompare(b.ruleId) ||
    a.artifactId.localeCompare(b.artifactId)
  );

  const report = {
    format: 'SCP1',
    verdict: findings.length === 0 ? 'compliant' : 'non_compliant',
    counts: { artifacts: normalizedArtifacts.length, rules: normalizedRules.length, findings: findings.length },
    findings,
  };
  return freezeDeep(report);
}

function canonicalPayload(report) { return JSON.stringify(stable(report)); }

export function serializeCompliance(report) {
  assertPlainRecord(report, 'report');
  const payload = canonicalPayload(report);
  const checksum = crypto.createHash('sha256').update(payload).digest('hex');
  return JSON.stringify({ format: 'SCP1', checksum, payload });
}

export function parseCompliance(serialized) {
  assertString(serialized, 'serialized report');
  let envelope;
  try { envelope = JSON.parse(serialized); } catch { fail('INVALID_SERIALIZATION', 'report envelope is not valid JSON'); }
  assertPlainRecord(envelope, 'report envelope');
  if (envelope.format !== 'SCP1' || typeof envelope.checksum !== 'string' || typeof envelope.payload !== 'string') fail('INVALID_SERIALIZATION', 'unsupported report envelope');
  const actual = crypto.createHash('sha256').update(envelope.payload).digest('hex');
  if (actual !== envelope.checksum) fail('INTEGRITY_MISMATCH', 'report checksum mismatch');
  let report;
  try { report = JSON.parse(envelope.payload); } catch { fail('INVALID_SERIALIZATION', 'report payload is invalid JSON'); }
  scanSafe(report, new Set(), 0, 0, 'report');
  return freezeDeep(stable(report));
}
