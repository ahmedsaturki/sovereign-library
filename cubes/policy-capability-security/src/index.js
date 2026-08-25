const DEFAULT_LIMITS = Object.freeze({
  maxRules: 512,
  maxPatternBytes: 2048,
  maxContextKeys: 64,
  maxContextValueBytes: 4096,
  maxPredicates: 32,
  maxDiagnosticBytes: 2048,
});

class PolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PolicyError';
    this.code = code;
    Object.freeze(this);
  }
}

const fail = (code, message) => { throw new PolicyError(code, message); };
const isObject = v => v !== null && typeof v === 'object';
const bytes = v => Buffer.byteLength(String(v), 'utf8');

function validatePlainObject(value, label) {
  if (!isObject(value) || Array.isArray(value)) fail('INVALID_POLICY', `${label} must be an object`);
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_POLICY', `${label} contains accessor property`);
  }
}

function normalizeLimits(input = {}) {
  validatePlainObject(input, 'limits');
  const limits = Object.freeze({ ...DEFAULT_LIMITS, ...input });
  for (const [k, v] of Object.entries(limits)) {
    if (!Number.isSafeInteger(v) || v < 1) fail('INVALID_POLICY', `${k} must be a positive safe integer`);
  }
  return limits;
}

function normalizeScalar(value, label, limits) {
  if (!(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null)) fail('INVALID_CONTEXT', `${label} must be scalar`);
  if (bytes(value) > limits.maxContextValueBytes) fail('LIMIT_EXCEEDED', `${label} exceeds size limit`);
  return value;
}

function normalizeContext(context, limits) {
  validatePlainObject(context, 'context');
  const keys = Object.keys(context).sort();
  if (keys.length > limits.maxContextKeys) fail('LIMIT_EXCEEDED', 'Context key limit exceeded');
  const result = {};
  for (const key of keys) result[key] = normalizeScalar(context[key], `context.${key}`, limits);
  return Object.freeze(result);
}

function splitPattern(pattern, limits) {
  if (typeof pattern !== 'string' || !pattern || bytes(pattern) > limits.maxPatternBytes) fail('INVALID_POLICY', 'Invalid pattern');
  const segments = pattern.split('/');
  if (segments.some(s => s === '' || s.includes('***'))) fail('INVALID_POLICY', 'Malformed pattern');
  if (segments.filter(s => s === '**').length > 1) fail('INVALID_POLICY', 'Malformed pattern');
  return segments;
}

function matchPattern(pattern, value, limits) {
  const p = splitPattern(pattern, limits);
  if (typeof value !== 'string') return { matched: false, specificity: 0 };
  const v = value.split('/');
  function walk(i, j) {
    if (i === p.length) return j === v.length;
    if (p[i] === '**') return walk(i + 1, j) || (j < v.length && walk(i, j + 1));
    if (j >= v.length) return false;
    if (p[i] !== '*' && p[i] !== v[j]) return false;
    return walk(i + 1, j + 1);
  }
  if (!walk(0, 0)) return { matched: false, specificity: 0 };
  const specificity = p.reduce((score, seg) => score + (seg === '**' ? 0 : seg === '*' ? 1 : 2), 0);
  return { matched: true, specificity };
}

function normalizeWhen(when, limits) {
  if (when === undefined) return Object.freeze([]);
  validatePlainObject(when, 'when');
  const keys = Object.keys(when).sort();
  if (keys.length > limits.maxPredicates) fail('LIMIT_EXCEEDED', 'Predicate limit exceeded');
  return Object.freeze(keys.map(key => Object.freeze({ key, value: normalizeScalar(when[key], `when.${key}`, limits) })));
}

function normalizeRule(rule, limits) {
  validatePlainObject(rule, 'rule');
  if (typeof rule.id !== 'string' || !rule.id) fail('INVALID_POLICY', 'Rule id is required');
  if (!['allow', 'deny'].includes(rule.effect)) fail('INVALID_POLICY', 'Rule effect must be allow or deny');
  const action = String(rule.action ?? '');
  const resource = String(rule.resource ?? '');
  splitPattern(action, limits); splitPattern(resource, limits);
  const priority = rule.priority === undefined ? 0 : rule.priority;
  if (!Number.isSafeInteger(priority)) fail('INVALID_POLICY', 'Rule priority must be a safe integer');
  return Object.freeze({
    id: rule.id,
    effect: rule.effect,
    action,
    resource,
    priority,
    when: normalizeWhen(rule.when, limits),
  });
}

function satisfiesWhen(when, context) {
  return when.every(predicate => Object.prototype.hasOwnProperty.call(context, predicate.key) && context[predicate.key] === predicate.value);
}

function compareRules(a, b) {
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.specificity !== b.specificity) return b.specificity - a.specificity;
  if (a.effect !== b.effect) return a.effect === 'deny' ? -1 : 1;
  return a.id.localeCompare(b.id);
}

function createAuditRecord(input) {
  const record = Object.freeze({
    action: input.action,
    resource: input.resource,
    allowed: input.allowed,
    winningRuleId: input.winningRuleId,
    matchedRuleIds: Object.freeze([...input.matchedRuleIds]),
    ruleCount: input.ruleCount,
  });
  return Object.freeze(record);
}

function toPublicRule(rule) {
  const when = {};
  for (const predicate of rule.when) when[predicate.key] = predicate.value;
  return Object.freeze({
    id: rule.id,
    effect: rule.effect,
    action: rule.action,
    resource: rule.resource,
    priority: rule.priority,
    when: Object.freeze(when),
  });
}

function createPolicyEngine(config = {}) {
  validatePlainObject(config, 'config');
  const limits = normalizeLimits(config.limits ?? {});
  if (!Array.isArray(config.rules) || config.rules.length > limits.maxRules) fail('INVALID_POLICY', 'Invalid rules collection');
  const ids = new Set();
  const rules = config.rules.map(rule => {
    const normalized = normalizeRule(rule, limits);
    if (ids.has(normalized.id)) fail('INVALID_POLICY', `Duplicate rule id: ${normalized.id}`);
    ids.add(normalized.id);
    return normalized;
  });
  const frozenRules = Object.freeze([...rules].sort((a, b) => a.id.localeCompare(b.id)));

  function evaluate(request = {}) {
    validatePlainObject(request, 'request');
    const action = request.action;
    const resource = request.resource;
    if (typeof action !== 'string' || typeof resource !== 'string') fail('INVALID_REQUEST', 'Action and resource are required');
    const context = normalizeContext(request.context ?? {}, limits);
    const candidates = [];
    for (const rule of frozenRules) {
      const actionMatch = matchPattern(rule.action, action, limits);
      if (!actionMatch.matched) continue;
      const resourceMatch = matchPattern(rule.resource, resource, limits);
      if (!resourceMatch.matched || !satisfiesWhen(rule.when, context)) continue;
      candidates.push({ rule, specificity: actionMatch.specificity + resourceMatch.specificity });
    }
    candidates.sort((a, b) => compareRules({ ...a.rule, specificity: a.specificity }, { ...b.rule, specificity: b.specificity }));
    const winner = candidates[0]?.rule ?? null;
    const allowed = winner?.effect === 'allow';
    const audit = createAuditRecord({
      action,
      resource,
      allowed,
      winningRuleId: winner?.id ?? null,
      matchedRuleIds: candidates.map(candidate => candidate.rule.id),
      ruleCount: frozenRules.length,
    });
    if (bytes(JSON.stringify(audit)) > limits.maxDiagnosticBytes) fail('LIMIT_EXCEEDED', 'Decision diagnostics exceed limit');
    return audit;
  }

  function snapshot() {
    return Object.freeze({
      rules: Object.freeze(frozenRules.map(toPublicRule)),
    });
  }

  function compose(other) {
    if (!other || typeof other.snapshot !== 'function') fail('INVALID_POLICY', 'Invalid policy composition source');
    const combined = [...frozenRules.map(toPublicRule), ...other.snapshot().rules];
    return createPolicyEngine({ rules: combined, limits });
  }

  return Object.freeze({ limits, rules: frozenRules, evaluate, snapshot, compose });
}

export { DEFAULT_LIMITS, PolicyError, createPolicyEngine };
