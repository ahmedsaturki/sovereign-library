import crypto from 'node:crypto';

export const MAX_CLAUSES = 256;
export const MAX_EVIDENCE = 512;
export const MAX_STRING = 4096;
export const MAX_DEPTH = 8;
export const MAX_NODES = 2048;

const KINDS = new Set(['required', 'optional']);
const CATEGORIES = new Set(['identity', 'digest', 'version', 'lifecycle', 'provenance', 'compliance', 'metadata', 'custom']);
const PREDICATES = new Set(['exists', 'equals', 'in', 'notIn', 'semverGte', 'semverLt', 'truthy', 'falsy']);

export class AdmissionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdmissionError';
    this.code = code;
    Object.freeze(this);
  }
}

function fail(code, message) { throw new AdmissionError(code, message); }
function assertString(v, label) { if (typeof v !== 'string' || v.length > MAX_STRING) fail('INVALID_INPUT', `${label} must be a bounded string`); }
function assertPlain(v, label) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) fail('INVALID_INPUT', `${label} must be an object`);
  for (const k of Reflect.ownKeys(v)) {
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (!d || !('value' in d)) fail('ACCESSOR_INPUT', `${label} contains an accessor property`);
    if (typeof k !== 'string') fail('INVALID_INPUT', `${label} has unsupported key type`);
  }
}
function scan(v, seen, depth = 0, nodes = 0, label = 'input') {
  if (depth > MAX_DEPTH) fail('BOUNDS', `${label} exceeds depth limit`);
  if (v === null || typeof v !== 'object') return nodes + 1;
  if (seen.has(v)) fail('CIRCULAR_INPUT', `${label} is circular`);
  seen.add(v);
  let total = nodes + 1;
  if (Array.isArray(v)) {
    const descriptors = Object.getOwnPropertyDescriptors(v);
    for (const d of Object.values(descriptors)) if (!('value' in d)) fail('ACCESSOR_INPUT', `${label} contains an accessor property`);
    for (const child of v) total = scan(child, seen, depth + 1, total, label);
  } else {
    assertPlain(v, label);
    for (const child of Object.values(v)) total = scan(child, seen, depth + 1, total, label);
  }
  seen.delete(v);
  if (total > MAX_NODES) fail('BOUNDS', `${label} exceeds node limit`);
  return total;
}
function clone(v) { return structuredClone(v); }
function stable(v) { if (Array.isArray(v)) return v.map(stable); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])); return v; }
function freezeDeep(v) { if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const x of Object.values(v)) freezeDeep(x); Object.freeze(v); } return v; }
function splitPath(path) { assertString(path, 'field'); if (!/^[A-Za-z0-9_.-]+$/.test(path)) fail('INVALID_INPUT', 'field path contains unsupported characters'); return path.split('.'); }
function readPath(obj, path) { let cur = obj; for (const part of splitPath(path)) { if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, part)) return { exists: false, value: undefined }; cur = cur[part]; } return { exists: true, value: cur }; }
function parseSemver(v) { if (typeof v !== 'string' || !/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(v)) return null; const [core] = v.replace(/^v/, '').split(/[+-]/); return core.split('.').map(Number); }
function semverCompare(a, b) { const pa = parseSemver(a); const pb = parseSemver(b); if (!pa || !pb) fail('INVALID_VERSION', 'invalid semantic version'); for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i]; return 0; }
function normalizeClause(input) { assertPlain(input, 'clause'); scan(input, new Set(), 0, 0, 'clause'); assertString(input.id, 'clause.id'); assertString(input.kind, 'clause.kind'); assertString(input.category, 'clause.category'); assertString(input.predicate, 'clause.predicate'); if (!KINDS.has(input.kind) || !CATEGORIES.has(input.category) || !PREDICATES.has(input.predicate)) fail('INVALID_CLAUSE', 'unsupported clause kind/category/predicate'); if (input.field !== undefined) assertString(input.field, 'clause.field'); return stable(clone(input)); }
function normalizeClauses(clauses) { if (!Array.isArray(clauses) || clauses.length > MAX_CLAUSES) fail('BOUNDS', 'clause count exceeds limit'); const seen = new Set(); const out = []; for (const clause of clauses) { const c = normalizeClause(clause); if (seen.has(c.id)) fail('DUPLICATE_CLAUSE', `duplicate clause id: ${c.id}`); seen.add(c.id); out.push(c); } out.sort((a, b) => a.id.localeCompare(b.id)); return out; }
function evaluateClause(artifact, clause) { const { exists, value } = readPath(artifact, clause.field ?? ''); switch (clause.predicate) { case 'exists': return exists === Boolean(clause.expected); case 'equals': return exists && Object.is(value, clause.expected); case 'in': return exists && Array.isArray(clause.expected) && clause.expected.some((x) => Object.is(x, value)); case 'notIn': return !exists || (Array.isArray(clause.expected) && clause.expected.every((x) => !Object.is(x, value))); case 'semverGte': return exists && semverCompare(String(value), String(clause.expected)) >= 0; case 'semverLt': return exists && semverCompare(String(value), String(clause.expected)) < 0; case 'truthy': return exists && Boolean(value) === true; case 'falsy': return !exists || !value; default: fail('INVALID_CLAUSE', 'unsupported predicate'); } }
function reason(clause, artifact, passed) { return { clauseId: clause.id, artifactId: artifact.id, kind: clause.kind, category: clause.category, passed, blocking: clause.kind === 'required' && !passed }; }
export function evaluateAdmission(artifact, config) { assertPlain(artifact, 'artifact'); scan(artifact, new Set(), 0, 0, 'artifact'); assertString(artifact.id, 'artifact.id'); assertPlain(config, 'config'); scan(config, new Set(), 0, 0, 'config'); const clauses = normalizeClauses(config.clauses ?? []); const results = clauses.map((c) => reason(c, artifact, evaluateClause(artifact, c))); const blocking = results.filter((x) => x.blocking); const verdict = blocking.length === 0 ? 'eligible' : 'blocked'; return freezeDeep({ format: 'SAG1', verdict, artifactId: artifact.id, counts: { clauses: clauses.length, passed: results.filter((x) => x.passed).length, failed: results.filter((x) => !x.passed).length, blocking: blocking.length }, reasons: results }); }
export function serializeAdmission(report) { assertPlain(report, 'report'); const payload = JSON.stringify(stable(report)); const checksum = crypto.createHash('sha256').update(payload).digest('hex'); return JSON.stringify({ format: 'SAG1', checksum, payload }); }
export function parseAdmission(serialized) { assertString(serialized, 'serialized'); let env; try { env = JSON.parse(serialized); } catch { fail('INVALID_SERIALIZATION', 'invalid JSON envelope'); } assertPlain(env, 'envelope'); if (env.format !== 'SAG1' || typeof env.checksum !== 'string' || typeof env.payload !== 'string') fail('INVALID_SERIALIZATION', 'invalid SAG1 envelope'); const actual = crypto.createHash('sha256').update(env.payload).digest('hex'); if (actual !== env.checksum) fail('INTEGRITY_MISMATCH', 'checksum mismatch'); let report; try { report = JSON.parse(env.payload); } catch { fail('INVALID_SERIALIZATION', 'invalid payload'); } scan(report, new Set(), 0, 0, 'report'); return freezeDeep(stable(report)); }
