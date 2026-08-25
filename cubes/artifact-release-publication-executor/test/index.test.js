import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicationPlan,
  executePublicationPlan,
  parsePublicationSnapshot,
  serializePublicationSnapshot,
  PUBLICATION_FORMAT,
} from '../src/index.js';

const digest = 'sha256:' + 'a'.repeat(64);
const closure = {
  receiptId: 'closure-1',
  snapshotId: 'snapshot-1',
  snapshotChecksum: digest,
  approvalId: 'approval-1',
  approvalChecksum: digest,
  status: 'closed',
};

const destination = (log, id = 'dest-a') => ({
  destinationId: id,
  operations: ['publish', 'replace'],
  async prepare(intent) {
    log.push(['prepare', intent.intentId]);
    return { intentId: intent.intentId, artifactId: intent.artifactId };
  },
  async commit(prepared) {
    log.push(['commit', prepared.intentId]);
    return { committed: prepared.artifactId };
  },
});

const intent = (id, overrides = {}) => ({
  intentId: id,
  idempotencyKey: `idem-${id}`,
  destinationId: 'dest-a',
  artifactId: `artifact-${id}`,
  artifactDigest: digest,
  operations: ['publish'],
  payload: { z: 2, a: 1 },
  evidenceRefs: ['evidence:b', 'evidence:a'],
  ...overrides,
});

test('builds deterministic plans independent of insertion order and freezes them', () => {
  const one = buildPublicationPlan({ closureReceipt: closure, intents: [intent('b'), intent('a')], destinations: [destination([])] });
  const two = buildPublicationPlan({ closureReceipt: closure, intents: [intent('a'), intent('b')], destinations: [destination([])] });
  assert.deepEqual(one, two);
  assert.equal(one.intents[0].intent.intentId, 'a');
  assert.equal(Object.isFrozen(one), true);
  assert.equal(Object.isFrozen(one.intents[0]), true);
  assert.equal(Object.isFrozen(one.intents[0].intent), true);
});

test('rejects non-closed receipts before destination side effects can occur', () => {
  const log = [];
  assert.throws(() => buildPublicationPlan({ closureReceipt: { ...closure, status: 'approved' }, intents: [intent('a')], destinations: [destination(log)] }), (error) => error.code === 'CLOSURE_NOT_CLOSED');
  assert.deepEqual(log, []);
});

test('rejects duplicates, conflicts, unsupported operations, and unknown destinations', () => {
  assert.throws(() => buildPublicationPlan({ closureReceipt: closure, intents: [intent('a'), intent('a')], destinations: [destination([])] }), (error) => error.code === 'DUPLICATE_INTENT');
  assert.throws(() => buildPublicationPlan({ closureReceipt: closure, intents: [intent('a'), intent('b', { idempotencyKey: 'idem-a' })], destinations: [destination([])] }), (error) => error.code === 'DUPLICATE_IDEMPOTENCY_KEY');
  assert.throws(() => buildPublicationPlan({ closureReceipt: closure, intents: [intent('a', { operations: ['remove'] })], destinations: [destination([])] }), (error) => error.code === 'OPERATION_NOT_ALLOWED');
  assert.throws(() => buildPublicationPlan({ closureReceipt: closure, intents: [intent('a', { destinationId: 'missing' })], destinations: [destination([])] }), (error) => error.code === 'UNKNOWN_DESTINATION');
});

test('rejects duplicate destination identities and malformed inputs fail closed', () => {
  assert.throws(() => buildPublicationPlan({ closureReceipt: closure, intents: [intent('a')], destinations: [destination([], 'dest-a'), destination([], 'dest-a')] }), (error) => error.code === 'DUPLICATE_DESTINATION');
  const accessor = { ...intent('accessor') };
  Object.defineProperty(accessor, 'intentId', { get() { throw new Error('getter must not execute'); } });
  assert.throws(() => buildPublicationPlan({ closureReceipt: closure, intents: [accessor], destinations: [destination([])] }), (error) => error.code === 'ACCESSOR_INPUT');
  const circular = intent('cycle');
  circular.payload.self = circular.payload;
  assert.throws(() => buildPublicationPlan({ closureReceipt: closure, intents: [circular], destinations: [destination([])] }), (error) => error.code === 'CIRCULAR_INPUT');
});

test('rejects unsupported JSON values and oversized payloads', () => {
  assert.throws(() => buildPublicationPlan({ closureReceipt: closure, intents: [intent('big', { payload: 'x'.repeat(70 * 1024) })], destinations: [destination([])] }), (error) => error.code === 'LIMIT_EXCEEDED');
  assert.throws(() => buildPublicationPlan({ closureReceipt: closure, intents: [intent('big', { payload: { value: BigInt(1) } })], destinations: [destination([])] }), (error) => error.code === 'UNSUPPORTED_VALUE');
  assert.throws(() => buildPublicationPlan({ closureReceipt: closure, intents: [intent('nan', { payload: { value: Number.NaN } })], destinations: [destination([])] }), (error) => error.code === 'UNSUPPORTED_VALUE');
});

test('executes only after planning, preserves order, and returns immutable outcomes', async () => {
  const log = [];
  const plan = buildPublicationPlan({ closureReceipt: closure, intents: [intent('b'), intent('a')], destinations: [destination(log)] });
  const outcomes = await executePublicationPlan(plan, [destination(log)]);
  assert.deepEqual(log, [['prepare', 'a'], ['commit', 'a'], ['prepare', 'b'], ['commit', 'b']]);
  assert.deepEqual(outcomes.outcomes.map((item) => item.state), ['succeeded', 'succeeded']);
  assert.equal(Object.isFrozen(outcomes), true);
  assert.equal(Object.isFrozen(outcomes.outcomes), true);
});

test('is idempotent across repeated execution with a shared ledger', async () => {
  const log = [];
  const ledger = new Map();
  const plan = buildPublicationPlan({ closureReceipt: closure, intents: [intent('a')], destinations: [destination(log)] });
  const first = await executePublicationPlan(plan, [destination(log)], { ledger });
  const second = await executePublicationPlan(plan, [destination(log)], { ledger });
  assert.equal(first.outcomes[0].state, 'succeeded');
  assert.equal(second.outcomes[0].state, 'skipped_idempotent');
  assert.deepEqual(log, [['prepare', 'a'], ['commit', 'a']]);
});

test('a destination failure becomes a typed terminal outcome and later valid execution recovers', async () => {
  let failNext = true;
  const calls = [];
  const failing = {
    destinationId: 'dest-a',
    operations: ['publish'],
    async prepare(intentRecord) { calls.push(`prepare:${intentRecord.intentId}`); return intentRecord; },
    async commit(record) {
      calls.push(`commit:${record.intentId}`);
      if (failNext) { failNext = false; throw new Error('boom'); }
      return { ok: true };
    },
  };
  const plan = buildPublicationPlan({ closureReceipt: closure, intents: [intent('a'), intent('b')], destinations: [failing] });
  const ledger = new Map();
  const failed = await executePublicationPlan(plan, [failing], { ledger });
  assert.equal(failed.outcomes[0].state, 'failed');
  assert.equal(failed.outcomes.length, 1);
  const recovered = await executePublicationPlan(plan, [failing], { ledger });
  assert.deepEqual(recovered.outcomes.map((item) => item.state), ['succeeded', 'succeeded']);
  assert.deepEqual(calls, ['prepare:a', 'commit:a', 'prepare:a', 'commit:a', 'prepare:b', 'commit:b']);
});

test('serialization is deterministic and integrity protected', () => {
  const snapshot = { format: PUBLICATION_FORMAT, mode: 'publication_outcome', value: { z: 2, a: 1 } };
  const first = serializePublicationSnapshot(snapshot);
  const second = serializePublicationSnapshot({ mode: 'publication_outcome', format: PUBLICATION_FORMAT, value: { a: 1, z: 2 } });
  assert.equal(first, second);
  assert.deepEqual(parsePublicationSnapshot(first), snapshot);
  const envelope = JSON.parse(first);
  envelope.payload = envelope.payload.replace('publication_outcome', 'tampered');
  assert.throws(() => parsePublicationSnapshot(JSON.stringify(envelope)), (error) => error.code === 'INTEGRITY_MISMATCH');
});

test('serialization rejects malformed envelopes and supports recovery', () => {
  assert.throws(() => parsePublicationSnapshot('{not-json'), (error) => error.code === 'MALFORMED_SERIALIZATION');
  assert.throws(() => parsePublicationSnapshot(JSON.stringify({ format: 'NOPE', checksum: '0'.repeat(64), payload: '{}' })), (error) => error.code === 'INVALID_FORMAT');
  const valid = serializePublicationSnapshot({ ok: true });
  assert.deepEqual(parsePublicationSnapshot(valid), { ok: true });
});
