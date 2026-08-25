import crypto from 'node:crypto';

export const MAX_SCOPES = 256;
export const MAX_DECISIONS = 2048;
export const MAX_EVIDENCE = 2048;
export const MAX_STRING = 4096;
export const MAX_DEPTH = 8;
export const MAX_NODES = 4096;

const DECISION_STATES = new Set(['approve', 'reject', 'abstain']);
const ID = /^[-A-Za-z0-9_.:]+$/;
const SHA256 = /^[0-9a-f]{64}$/;

export class ReleaseApprovalError extends Error {
  constructor(code, message) { super(message); this.name = 'ReleaseApprovalError'; this.code = code; Object.freeze(this); }
}
function fail(code, message) { throw new ReleaseApprovalError(code, message); }
function assertString(value, label) { if (typeof value !== 'string' || value.length === 0 || value.length > MAX_STRING) fail('INVALID_INPUT', `${label} must be a bounded non-empty string`); }
function assertPlain(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', `${label} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) { const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d)) fail('ACCESSOR_INPUT', `${label} contains an accessor property`); if (typeof key !== 'string') fail('INVALID_INPUT', `${label} has unsupported key type`); }
}
function scanSafe(value, seen, depth = 0, nodes = 0, label = 'input') {
  if (depth > MAX_DEPTH) fail('BOUNDS', `${label} exceeds maximum depth`);
  if (value === null || typeof value !== 'object') return nodes + 1;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  seen.add(value); let total = nodes + 1;
  if (Array.isArray(value)) {
    for (const d of Object.values(Object.getOwnPropertyDescriptors(value))) if (!('value' in d)) fail('ACCESSOR_INPUT', `${label} contains an accessor property`);
    for (const child of value) total = scanSafe(child, seen, depth + 1, total, label);
  } else { assertPlain(value, label); for (const child of Object.values(value)) total = scanSafe(child, seen, depth + 1, total, label); }
  seen.delete(value); if (total > MAX_NODES) fail('BOUNDS', `${label} exceeds maximum node count`); return total;
}
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; }
function freezeDeep(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freezeDeep(child); Object.freeze(value); } return value; }
function validateSnapshot(snapshot) {
  assertPlain(snapshot, 'snapshot'); scanSafe(snapshot, new Set(), 0, 0, 'snapshot');
  assertString(snapshot.snapshotId, 'snapshot.snapshotId'); if (!ID.test(snapshot.snapshotId)) fail('INVALID_SNAPSHOT_ID', 'invalid snapshotId');
  assertString(snapshot.snapshotChecksum, 'snapshot.snapshotChecksum'); if (!SHA256.test(snapshot.snapshotChecksum)) fail('INVALID_SNAPSHOT_CHECKSUM', 'invalid snapshot checksum');
  return { snapshotId: snapshot.snapshotId, snapshotChecksum: snapshot.snapshotChecksum };
}
function normalizeScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length > MAX_SCOPES) fail('BOUNDS', 'scope count exceeds limit');
  const seen = new Set(); const normalized = [];
  for (const scope of scopes) {
    assertPlain(scope, 'scope'); scanSafe(scope, new Set(), 0, 0, 'scope'); assertString(scope.id, 'scope.id'); if (!ID.test(scope.id)) fail('INVALID_SCOPE_ID', `invalid scope id: ${scope.id}`);
    if (scope.required !== undefined && typeof scope.required !== 'boolean') fail('INVALID_SCOPE', `required must be boolean for ${scope.id}`);
    if (seen.has(scope.id)) fail('DUPLICATE_SCOPE', `duplicate scope id: ${scope.id}`);
    seen.add(scope.id); normalized.push({ id: scope.id, required: scope.required ?? true });
  }
  normalized.sort((a, b) => a.id.localeCompare(b.id)); return normalized;
}
function normalizeDecision(decision, scopeIds) {
  assertPlain(decision, 'decision'); scanSafe(decision, new Set(), 0, 0, 'decision');
  assertString(decision.id, 'decision.id'); if (!ID.test(decision.id)) fail('INVALID_DECISION_ID', `invalid decision id: ${decision.id}`);
  assertString(decision.reviewerId, 'decision.reviewerId'); if (!ID.test(decision.reviewerId)) fail('INVALID_REVIEWER_ID', `invalid reviewer id: ${decision.reviewerId}`);
  assertString(decision.scopeId, 'decision.scopeId'); if (!scopeIds.has(decision.scopeId)) fail('UNKNOWN_SCOPE', `unknown scope: ${decision.scopeId}`);
  assertString(decision.state, 'decision.state'); if (!DECISION_STATES.has(decision.state)) fail('INVALID_STATE', `invalid decision state: ${decision.state}`);
  const refs = decision.evidenceRefs ?? []; if (!Array.isArray(refs) || refs.length > MAX_EVIDENCE) fail('INVALID_EVIDENCE', `invalid evidenceRefs for ${decision.id}`);
  const evidenceRefs = refs.map((ref) => { assertString(ref, 'evidenceRef'); return ref; });
  return { id: decision.id, reviewerId: decision.reviewerId, scopeId: decision.scopeId, state: decision.state, evidenceRefs };
}

export function buildReleaseApproval(snapshot, scopes, decisions, config = {}) {
  const normalizedSnapshot = validateSnapshot(snapshot); const normalizedScopes = normalizeScopes(scopes);
  if (!Array.isArray(decisions) || decisions.length > MAX_DECISIONS) fail('BOUNDS', 'decision count exceeds limit');
  assertPlain(config, 'config'); scanSafe(config, new Set(), 0, 0, 'config'); const maxEvidence = config.maxEvidence ?? MAX_EVIDENCE;
  if (!Number.isInteger(maxEvidence) || maxEvidence < 0 || maxEvidence > MAX_EVIDENCE) fail('INVALID_LIMIT', 'maxEvidence is invalid');
  const scopeIds = new Set(normalizedScopes.map((scope) => scope.id)); const seenIds = new Set(); const seenPairs = new Set(); const normalizedDecisions = [];
  for (const raw of decisions) {
    const decision = normalizeDecision(raw, scopeIds); if (seenIds.has(decision.id)) fail('DUPLICATE_DECISION', `duplicate decision id: ${decision.id}`); seenIds.add(decision.id);
    const pair = `${decision.reviewerId}\u0000${decision.scopeId}`;
    if (seenPairs.has(pair)) fail('CONFLICTING_DECISION', `conflicting decision for reviewer/scope: ${decision.reviewerId}/${decision.scopeId}`);
    seenPairs.add(pair); decision.evidenceRefs = decision.evidenceRefs.slice(0, maxEvidence); normalizedDecisions.push(decision);
  }
  normalizedDecisions.sort((a, b) => a.scopeId.localeCompare(b.scopeId) || a.reviewerId.localeCompare(b.reviewerId) || a.id.localeCompare(b.id));
  const requiredScopes = normalizedScopes.filter((scope) => scope.required);
  const scopeStates = requiredScopes.map((scope) => {
    const scoped = normalizedDecisions.filter((decision) => decision.scopeId === scope.id);
    const rejected = scoped.some((decision) => decision.state === 'reject');
    const approved = scoped.some((decision) => decision.state === 'approve');
    return { scopeId: scope.id, status: rejected ? 'rejected' : approved ? 'approved' : 'pending' };
  });
  const status = scopeStates.some((scope) => scope.status === 'rejected') ? 'rejected' : scopeStates.every((scope) => scope.status === 'approved') ? 'approved' : 'pending';
  return freezeDeep({ format: 'SAD1', mode: 'approval_record', snapshot: normalizedSnapshot, status, counts: { scopes: normalizedScopes.length, requiredScopes: requiredScopes.length, decisions: normalizedDecisions.length }, scopeStates, decisions: normalizedDecisions });
}
export function serializeReleaseApproval(record) {
  assertPlain(record, 'record'); scanSafe(record, new Set(), 0, 0, 'record'); const payload = JSON.stringify(stable(record)); const checksum = crypto.createHash('sha256').update(payload).digest('hex'); return JSON.stringify({ format: 'SAD1', checksum, payload });
}
export function parseReleaseApproval(serialized) {
  assertString(serialized, 'serialized'); let envelope; try { envelope = JSON.parse(serialized); } catch { fail('INVALID_SERIALIZATION', 'invalid JSON envelope'); }
  assertPlain(envelope, 'envelope'); if (envelope.format !== 'SAD1' || typeof envelope.checksum !== 'string' || typeof envelope.payload !== 'string') fail('INVALID_SERIALIZATION', 'invalid SAD1 envelope');
  const actual = crypto.createHash('sha256').update(envelope.payload).digest('hex'); if (actual !== envelope.checksum) fail('INTEGRITY_MISMATCH', 'checksum mismatch');
  let record; try { record = JSON.parse(envelope.payload); } catch { fail('INVALID_SERIALIZATION', 'invalid payload'); }
  scanSafe(record, new Set(), 0, 0, 'record'); return freezeDeep(stable(record));
}
