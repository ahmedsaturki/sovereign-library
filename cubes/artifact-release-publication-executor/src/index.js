import { createHash } from 'node:crypto';

const FORMAT = 'SPE1';
const MAX_INTENTS = 256;
const MAX_EVIDENCE = 32;
const MAX_STRING = 2048;
const MAX_PAYLOAD = 64 * 1024;

const PUBLIC_OPERATIONS = new Set(['publish', 'replace', 'remove']);
const RESULT_STATES = new Set(['succeeded', 'skipped_idempotent', 'failed']);

export class PublicationExecutorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PublicationExecutorError';
    this.code = code;
    Object.freeze(this);
  }
}

function fail(code, message) {
  throw new PublicationExecutorError(code, message);
}

function assertSafeObject(value, label, seen = new Set(), depth = 0) {
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
    assertSafeObject(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function boundedString(value, label, max = MAX_STRING) {
  if (typeof value !== 'string' || value.length === 0) fail('INVALID_INPUT', `${label} must be a non-empty string`);
  if (value.length > max) fail('LIMIT_EXCEEDED', `${label} exceeds ${max} characters`);
  return value;
}

function boundedId(value, label) {
  boundedString(value, label, 256);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value)) fail('INVALID_ID', `${label} is malformed`);
  return value;
}

function boundedDigest(value, label) {
  boundedString(value, label, 128);
  if (!/^sha256:[0-9a-f]{64}$/.test(value)) fail('INVALID_DIGEST', `${label} must be sha256:<64 hex chars>`);
  return value;
}

function canonicalize(value) {
  assertSafeObject(value, 'value');
  try {
    return JSON.stringify(value, (_, item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
      }
      return item;
    });
  } catch {
    fail('UNSUPPORTED_VALUE', 'value cannot be serialized deterministically');
  }
}

function checksum(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function clone(value) {
  const serialized = canonicalize(value);
  return JSON.parse(serialized);
}

function normalizeClosure(receipt) {
  assertSafeObject(receipt, 'closureReceipt');
  if (!receipt || typeof receipt !== 'object') fail('INVALID_CLOSURE', 'closureReceipt must be an object');
  return {
    receiptId: boundedId(receipt.receiptId, 'closureReceipt.receiptId'),
    snapshotId: boundedId(receipt.snapshotId, 'closureReceipt.snapshotId'),
    snapshotChecksum: boundedDigest(receipt.snapshotChecksum, 'closureReceipt.snapshotChecksum'),
    approvalId: boundedId(receipt.approvalId, 'closureReceipt.approvalId'),
    approvalChecksum: boundedDigest(receipt.approvalChecksum, 'closureReceipt.approvalChecksum'),
    status: receipt.status,
  };
}

function normalizeIntent(intent) {
  assertSafeObject(intent, 'intent');
  const operations = Array.isArray(intent.operations) ? [...intent.operations] : fail('INVALID_INPUT', 'intent.operations must be an array');
  if (operations.length === 0) fail('INVALID_INPUT', 'intent.operations cannot be empty');
  if (operations.length > 8) fail('LIMIT_EXCEEDED', 'intent.operations exceeds maximum size');
  for (const operation of operations) if (!PUBLIC_OPERATIONS.has(operation)) fail('UNSUPPORTED_OPERATION', `Unsupported operation: ${operation}`);
  const payload = intent.payload === undefined ? null : clone(intent.payload);
  const payloadBytes = Buffer.byteLength(canonicalize(payload), 'utf8');
  if (payloadBytes > MAX_PAYLOAD) fail('LIMIT_EXCEEDED', 'intent.payload exceeds maximum size');
  const evidenceRefs = Array.isArray(intent.evidenceRefs) ? [...intent.evidenceRefs] : [];
  if (evidenceRefs.length > MAX_EVIDENCE) fail('LIMIT_EXCEEDED', 'intent.evidenceRefs exceeds maximum size');
  const normalizedEvidence = evidenceRefs.map((item, index) => boundedString(item, `intent.evidenceRefs[${index}]`, 512)).sort();
  return deepFreeze({
    intentId: boundedId(intent.intentId, 'intent.intentId'),
    idempotencyKey: boundedId(intent.idempotencyKey, 'intent.idempotencyKey'),
    destinationId: boundedId(intent.destinationId, 'intent.destinationId'),
    artifactId: boundedId(intent.artifactId, 'intent.artifactId'),
    artifactDigest: boundedDigest(intent.artifactDigest, 'intent.artifactDigest'),
    operations: [...new Set(operations)].sort(),
    payload,
    evidenceRefs: normalizedEvidence,
  });
}

function normalizeDestination(destination) {
  if (!destination || typeof destination !== 'object') fail('INVALID_DESTINATION', 'destination must be an object');
  const operations = Array.isArray(destination.operations) ? [...destination.operations] : fail('INVALID_INPUT', 'destination.operations must be an array');
  if (operations.length === 0) fail('INVALID_INPUT', 'destination.operations cannot be empty');
  for (const operation of operations) if (!PUBLIC_OPERATIONS.has(operation)) fail('UNSUPPORTED_OPERATION', `Unsupported destination operation: ${operation}`);
  if (typeof destination.prepare !== 'function' || typeof destination.commit !== 'function') fail('INVALID_DESTINATION', 'destination must expose prepare and commit functions');
  const descriptor = Object.getOwnPropertyDescriptor(destination, 'destinationId');
  if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', 'destination.destinationId is accessor-backed');
  return Object.freeze({
    destinationId: boundedId(destination.destinationId, 'destination.destinationId'),
    operations: [...new Set(operations)].sort(),
    prepare: destination.prepare,
    commit: destination.commit,
    rollbackSafe: destination.rollbackSafe === true,
  });
}

function sortUniqueById(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.intentId)) fail('DUPLICATE_INTENT', `${label} contains duplicate intentId ${item.intentId}`);
    seen.add(item.intentId);
  }
  return [...items].sort((left, right) => left.intentId.localeCompare(right.intentId));
}

function assertClosureReady(closureReceipt) {
  if (closureReceipt.status !== 'closed') fail('CLOSURE_NOT_CLOSED', 'closure receipt is not closed');
}

export function buildPublicationPlan({ closureReceipt, intents, destinations }) {
  const closure = normalizeClosure(closureReceipt);
  assertClosureReady(closure);
  if (!Array.isArray(intents)) fail('INVALID_INPUT', 'intents must be an array');
  if (!Array.isArray(destinations)) fail('INVALID_INPUT', 'destinations must be an array');
  if (intents.length > MAX_INTENTS) fail('LIMIT_EXCEEDED', `intents exceeds ${MAX_INTENTS}`);
  const normalizedIntents = sortUniqueById(intents.map(normalizeIntent), 'intents');
  const normalizedDestinations = destinations.map(normalizeDestination).sort((a, b) => a.destinationId.localeCompare(b.destinationId));
  const destinationMap = new Map();
  for (const destination of normalizedDestinations) {
    if (destinationMap.has(destination.destinationId)) fail('DUPLICATE_DESTINATION', `duplicate destinationId ${destination.destinationId}`);
    destinationMap.set(destination.destinationId, destination);
  }

  const seenIdempotency = new Set();
  const planIntents = normalizedIntents.map((intent) => {
    if (seenIdempotency.has(intent.idempotencyKey)) fail('DUPLICATE_IDEMPOTENCY_KEY', `duplicate idempotencyKey ${intent.idempotencyKey}`);
    seenIdempotency.add(intent.idempotencyKey);
    const destination = destinationMap.get(intent.destinationId);
    if (!destination) fail('UNKNOWN_DESTINATION', `Unknown destination ${intent.destinationId}`);
    for (const operation of intent.operations) if (!destination.operations.includes(operation)) fail('OPERATION_NOT_ALLOWED', `Operation ${operation} is not allowed for ${intent.destinationId}`);
    return deepFreeze({
      intent: clone(intent),
      destination: {
        destinationId: destination.destinationId,
        operations: [...destination.operations],
        rollbackSafe: destination.rollbackSafe,
      },
    });
  });

  const plan = {
    format: FORMAT,
    mode: 'publication_plan',
    closure,
    intents: planIntents,
  };
  return deepFreeze(clone(plan));
}

export async function executePublicationPlan(plan, destinations, { ledger } = {}) {
  assertSafeObject(plan, 'plan');
  if (!plan || plan.format !== FORMAT || plan.mode !== 'publication_plan') fail('INVALID_PLAN', 'invalid publication plan');
  if (!Array.isArray(destinations)) fail('INVALID_DESTINATION_SET', 'destinations must be an array');
  const destinationMap = new Map(destinations.map(normalizeDestination).map((destination) => [destination.destinationId, destination]));
  const committed = ledger ?? new Map();
  const outcomes = [];

  for (const entry of plan.intents) {
    const destination = destinationMap.get(entry.destination.destinationId);
    if (!destination) fail('UNKNOWN_DESTINATION', `Destination ${entry.destination.destinationId} is unavailable`);
    const { intent } = entry;
    if (committed.has(intent.idempotencyKey)) {
      outcomes.push({ intentId: intent.intentId, idempotencyKey: intent.idempotencyKey, state: 'skipped_idempotent', destinationId: destination.destinationId });
      continue;
    }
    try {
      const prepared = await destination.prepare(clone(intent));
      const result = await destination.commit(prepared);
      committed.set(intent.idempotencyKey, true);
      outcomes.push({ intentId: intent.intentId, idempotencyKey: intent.idempotencyKey, state: 'succeeded', destinationId: destination.destinationId, result: result === undefined ? null : clone(result) });
    } catch (error) {
      outcomes.push({ intentId: intent.intentId, idempotencyKey: intent.idempotencyKey, state: 'failed', destinationId: destination.destinationId, code: error instanceof PublicationExecutorError ? error.code : 'DESTINATION_FAILURE' });
      break;
    }
  }

  return deepFreeze({ format: FORMAT, mode: 'publication_outcome', closure: clone(plan.closure), outcomes: clone(outcomes) });
}

export function serializePublicationSnapshot(snapshot) {
  assertSafeObject(snapshot, 'snapshot');
  const payload = canonicalize(snapshot);
  const envelope = { format: FORMAT, checksum: checksum(payload), payload };
  return canonicalize(envelope);
}

export function parsePublicationSnapshot(serialized) {
  boundedString(serialized, 'serialized', MAX_PAYLOAD);
  let envelope;
  try { envelope = JSON.parse(serialized); } catch { fail('MALFORMED_SERIALIZATION', 'serialized snapshot is invalid JSON'); }
  assertSafeObject(envelope, 'envelope');
  if (envelope.format !== FORMAT) fail('INVALID_FORMAT', 'unsupported publication snapshot format');
  boundedString(envelope.payload, 'envelope.payload', MAX_PAYLOAD);
  boundedString(envelope.checksum, 'envelope.checksum', 64);
  if (!/^[0-9a-f]{64}$/.test(envelope.checksum)) fail('INVALID_CHECKSUM', 'checksum is malformed');
  if (checksum(envelope.payload) !== envelope.checksum) fail('INTEGRITY_MISMATCH', 'publication snapshot checksum mismatch');
  let payload;
  try { payload = JSON.parse(envelope.payload); } catch { fail('MALFORMED_SERIALIZATION', 'snapshot payload is invalid JSON'); }
  return deepFreeze(clone(payload));
}

export const PUBLICATION_RESULT_STATES = Object.freeze([...RESULT_STATES]);
export const PUBLICATION_FORMAT = FORMAT;
