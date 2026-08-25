import { createHash } from 'node:crypto';

const FORMAT = 'SPC1';
const MAX_RECORDS = 256;
const MAX_EVIDENCE = 32;
const MAX_STRING = 2048;
const MAX_METADATA = 8 * 1024;
const MAX_PAYLOAD = 64 * 1024;
const STATES = new Set(['succeeded', 'skipped_idempotent', 'failed']);
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export class PublicationConfirmationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PublicationConfirmationError';
    this.code = code;
    Object.freeze(this);
  }
}

function fail(code, message) {
  throw new PublicationConfirmationError(code, message);
}

function validateSafe(value, label, seen = new Set(), depth = 0) {
  if (depth > 12) fail('DEPTH_LIMIT', `${label} exceeds maximum depth`);
  if (value === null) return;
  const type = typeof value;
  if (type === 'function' || type === 'symbol' || type === 'bigint' || type === 'undefined') fail('UNSUPPORTED_VALUE', `${label} contains an unsupported value`);
  if (type === 'number' && !Number.isFinite(value)) fail('UNSUPPORTED_VALUE', `${label} contains a non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} contains a circular reference`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) fail('UNSUPPORTED_VALUE', `${label} must be a plain object`);
  seen.add(value);
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    validateSafe(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function stringValue(value, label, max = MAX_STRING) {
  if (typeof value !== 'string' || value.length === 0) fail('INVALID_INPUT', `${label} must be a non-empty string`);
  if (value.length > max) fail('LIMIT_EXCEEDED', `${label} exceeds ${max} characters`);
  return value;
}

function idValue(value, label) {
  stringValue(value, label, 256);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value)) fail('INVALID_ID', `${label} is malformed`);
  return value;
}

function digestValue(value, label) {
  stringValue(value, label, 128);
  if (!/^sha256:[0-9a-f]{64}$/.test(value)) fail('INVALID_DIGEST', `${label} must be sha256:<64 hex chars>`);
  return value;
}

function timestampValue(value, label) {
  stringValue(value, label, 64);
  if (!ISO_8601.test(value)) fail('INVALID_TIMESTAMP', `${label} must be an explicit ISO-8601 timestamp`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail('INVALID_TIMESTAMP', `${label} must be a valid ISO-8601 timestamp`);
  return date.toISOString();
}

function canonicalize(value) {
  validateSafe(value, 'value');
  try {
    return JSON.stringify(value, (_, item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
      return item;
    });
  } catch {
    fail('UNSUPPORTED_VALUE', 'value cannot be serialized deterministically');
  }
}

function checksum(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function clone(value) {
  return JSON.parse(canonicalize(value));
}

function closureIdentity(receipt) {
  validateSafe(receipt, 'closureReceipt');
  if (!receipt || receipt.status !== 'closed') fail('INVALID_CLOSURE', 'closureReceipt must be closed');
  return {
    receiptId: idValue(receipt.receiptId, 'closureReceipt.receiptId'),
    snapshotId: idValue(receipt.snapshotId, 'closureReceipt.snapshotId'),
    snapshotChecksum: digestValue(receipt.snapshotChecksum, 'closureReceipt.snapshotChecksum'),
    approvalId: idValue(receipt.approvalId, 'closureReceipt.approvalId'),
    approvalChecksum: digestValue(receipt.approvalChecksum, 'closureReceipt.approvalChecksum'),
  };
}

function normalizePlanIntent(intent, label) {
  validateSafe(intent, label);
  return {
    intentId: idValue(intent.intentId, `${label}.intentId`),
    idempotencyKey: idValue(intent.idempotencyKey, `${label}.idempotencyKey`),
    destinationId: idValue(intent.destinationId, `${label}.destinationId`),
    artifactId: idValue(intent.artifactId, `${label}.artifactId`),
    artifactDigest: digestValue(intent.artifactDigest, `${label}.artifactDigest`),
  };
}

function normalizeOutcome(outcome, index) {
  validateSafe(outcome, `outcome[${index}]`);
  if (!STATES.has(outcome.state)) fail('INVALID_STATE', `outcome[${index}].state is unsupported`);
  const evidenceRefs = Array.isArray(outcome.evidenceRefs) ? [...outcome.evidenceRefs] : [];
  if (evidenceRefs.length > MAX_EVIDENCE) fail('LIMIT_EXCEEDED', `outcome[${index}].evidenceRefs exceeds ${MAX_EVIDENCE}`);
  return {
    intentId: idValue(outcome.intentId, `outcome[${index}].intentId`),
    idempotencyKey: idValue(outcome.idempotencyKey, `outcome[${index}].idempotencyKey`),
    destinationId: idValue(outcome.destinationId, `outcome[${index}].destinationId`),
    artifactId: idValue(outcome.artifactId, `outcome[${index}].artifactId`),
    artifactDigest: digestValue(outcome.artifactDigest, `outcome[${index}].artifactDigest`),
    state: outcome.state,
    commitEvidence: outcome.commitEvidence === undefined ? null : stringValue(outcome.commitEvidence, `outcome[${index}].commitEvidence`, 4096),
    committedAt: outcome.committedAt === undefined ? null : timestampValue(outcome.committedAt, `outcome[${index}].committedAt`),
    evidenceRefs: evidenceRefs.map((ref, refIndex) => stringValue(ref, `outcome[${index}].evidenceRefs[${refIndex}]`, 512)).sort(),
  };
}

function normalizeMetadata(metadata) {
  if (metadata === undefined) return null;
  validateSafe(metadata, 'metadata');
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('INVALID_METADATA', 'metadata must be a plain object');
  const normalized = clone(metadata);
  if (Buffer.byteLength(canonicalize(normalized), 'utf8') > MAX_METADATA) fail('LIMIT_EXCEEDED', `metadata exceeds ${MAX_METADATA} bytes`);
  return normalized;
}

function assertExactClosure(outcomeClosure, expectedClosure) {
  validateSafe(outcomeClosure, 'outcomeSnapshot.closure');
  if (!outcomeClosure || typeof outcomeClosure !== 'object') fail('CLOSURE_MISMATCH', 'outcome snapshot must reference its originating closure receipt');
  const candidate = closureIdentity({ ...outcomeClosure, status: 'closed' });
  for (const field of Object.keys(expectedClosure)) {
    if (candidate[field] !== expectedClosure[field]) fail('CLOSURE_MISMATCH', `outcome closure ${field} does not match the originating closure receipt`);
  }
}

export function buildPublicationConfirmation({ closureReceipt, outcomeSnapshot, plan, metadata }) {
  const closure = closureIdentity(closureReceipt);
  validateSafe(outcomeSnapshot, 'outcomeSnapshot');
  if (!outcomeSnapshot || outcomeSnapshot.mode !== 'publication_outcome') fail('INVALID_OUTCOME', 'outcomeSnapshot must be publication_outcome');
  if (!Array.isArray(plan)) fail('INVALID_PLAN', 'plan must be an array');
  if (!Array.isArray(outcomeSnapshot.outcomes)) fail('INVALID_OUTCOME', 'outcomeSnapshot.outcomes must be an array');
  if (outcomeSnapshot.outcomes.length > MAX_RECORDS || plan.length > MAX_RECORDS) fail('LIMIT_EXCEEDED', 'confirmation input exceeds maximum size');
  assertExactClosure(outcomeSnapshot.closure, closure);
  const planMap = new Map();
  for (let index = 0; index < plan.length; index += 1) {
    const normalized = normalizePlanIntent(plan[index], `plan[${index}]`);
    if (planMap.has(normalized.intentId)) fail('DUPLICATE_PLAN_INTENT', `duplicate plan intent ${normalized.intentId}`);
    planMap.set(normalized.intentId, normalized);
  }
  const seen = new Set();
  const confirmations = outcomeSnapshot.outcomes.map(normalizeOutcome).sort((left, right) => left.intentId.localeCompare(right.intentId));
  for (const record of confirmations) {
    if (seen.has(record.intentId)) fail('DUPLICATE_CONFIRMATION', `duplicate confirmation ${record.intentId}`);
    seen.add(record.intentId);
    const expected = planMap.get(record.intentId);
    if (!expected) fail('OUTCOME_NOT_IN_PLAN', `outcome ${record.intentId} is not in the plan`);
    for (const field of ['idempotencyKey', 'destinationId', 'artifactId', 'artifactDigest']) {
      if (record[field] !== expected[field]) fail('OUTCOME_PLAN_MISMATCH', `${record.intentId}.${field} does not match the plan`);
    }
  }
  return freeze({
    format: FORMAT,
    mode: 'publication_confirmation',
    closure,
    metadata: normalizeMetadata(metadata),
    confirmations,
  });
}

export function serializePublicationConfirmation(receipt) {
  const payload = canonicalize(receipt);
  if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD) fail('LIMIT_EXCEEDED', `serialized payload exceeds ${MAX_PAYLOAD} bytes`);
  return canonicalize({ format: FORMAT, checksum: checksum(payload), payload });
}

export function parsePublicationConfirmation(serialized) {
  stringValue(serialized, 'serialized', MAX_PAYLOAD);
  let envelope;
  try { envelope = JSON.parse(serialized); } catch { fail('MALFORMED_SERIALIZATION', 'serialized confirmation is invalid JSON'); }
  validateSafe(envelope, 'envelope');
  if (envelope.format !== FORMAT) fail('INVALID_FORMAT', 'unsupported confirmation format');
  stringValue(envelope.payload, 'envelope.payload', MAX_PAYLOAD);
  stringValue(envelope.checksum, 'envelope.checksum', 64);
  if (!/^[0-9a-f]{64}$/.test(envelope.checksum)) fail('INVALID_CHECKSUM', 'checksum is malformed');
  if (checksum(envelope.payload) !== envelope.checksum) fail('INTEGRITY_MISMATCH', 'confirmation checksum mismatch');
  let payload;
  try { payload = JSON.parse(envelope.payload); } catch { fail('MALFORMED_SERIALIZATION', 'confirmation payload is invalid JSON'); }
  return freeze(clone(payload));
}

export const PUBLICATION_CONFIRMATION_FORMAT = FORMAT;
export const PUBLICATION_CONFIRMATION_STATES = Object.freeze([...STATES]);
