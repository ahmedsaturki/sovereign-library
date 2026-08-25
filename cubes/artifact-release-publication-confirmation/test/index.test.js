import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicationConfirmation,
  parsePublicationConfirmation,
  serializePublicationConfirmation,
  PUBLICATION_CONFIRMATION_FORMAT,
} from '../src/index.js';

const digest = 'sha256:' + 'b'.repeat(64);
const closure = {
  receiptId: 'closure-1', snapshotId: 'snapshot-1', snapshotChecksum: digest,
  approvalId: 'approval-1', approvalChecksum: digest, status: 'closed',
};
const plan = [
  { intentId: 'a', idempotencyKey: 'idem-a', destinationId: 'dest-a', artifactId: 'artifact-a', artifactDigest: digest },
  { intentId: 'b', idempotencyKey: 'idem-b', destinationId: 'dest-b', artifactId: 'artifact-b', artifactDigest: digest },
];
const outcome = (id = 'a', state = 'succeeded', overrides = {}) => ({
  intentId: id, idempotencyKey: `idem-${id}`, destinationId: `dest-${id}`, artifactId: `artifact-${id}`, artifactDigest: digest,
  state, evidenceRefs: ['evidence:b', 'evidence:a'], committedAt: '2026-08-25T12:00:00Z', ...overrides,
});

test('builds deterministic immutable confirmations', () => {
  const one = buildPublicationConfirmation({ closureReceipt: closure, plan, outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('b'), outcome('a')] } });
  const two = buildPublicationConfirmation({ closureReceipt: closure, plan, outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('a'), outcome('b')] } });
  assert.deepEqual(one, two);
  assert.equal(one.confirmations[0].intentId, 'a');
  assert.equal(Object.isFrozen(one), true);
  assert.equal(Object.isFrozen(one.confirmations), true);
});

test('accepts all explicit execution states without side effects', () => {
  for (const state of ['succeeded', 'skipped_idempotent', 'failed']) {
    const receipt = buildPublicationConfirmation({ closureReceipt: closure, plan: [plan[0]], outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('a', state)] } });
    assert.equal(receipt.confirmations[0].state, state);
  }
});

test('rejects closure mismatch, unknown intent, duplicate confirmation, and plan mismatches', () => {
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan, outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'other' }, outcomes: [outcome('a')] } }), (error) => error.code === 'CLOSURE_MISMATCH');
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan, outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('missing')] } }), (error) => error.code === 'OUTCOME_NOT_IN_PLAN');
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan, outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('a'), outcome('a')] } }), (error) => error.code === 'DUPLICATE_CONFIRMATION');
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan, outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('a', 'succeeded', { destinationId: 'wrong' })] } }), (error) => error.code === 'OUTCOME_PLAN_MISMATCH');
});

test('rejects invalid states, malformed timestamps, accessors, circular data, and oversized evidence', () => {
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan: [plan[0]], outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('a', 'unknown')] } }), (error) => error.code === 'INVALID_STATE');
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan: [plan[0]], outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('a', 'succeeded', { committedAt: 'bad' })] } }), (error) => error.code === 'INVALID_TIMESTAMP');
  const accessor = { ...outcome('a') }; Object.defineProperty(accessor, 'state', { get() { throw new Error('getter must not execute'); } });
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan: [plan[0]], outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [accessor] } }), (error) => error.code === 'ACCESSOR_INPUT');
  const circular = outcome('a'); circular.evidenceRefs.push(circular);
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan: [plan[0]], outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [circular] } }), (error) => error.code === 'CIRCULAR_INPUT');
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan: [plan[0]], outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('a', 'succeeded', { evidenceRefs: Array.from({ length: 33 }, (_, i) => `e-${i}`) })] } }), (error) => error.code === 'LIMIT_EXCEEDED');
});

test('rejects non-closed closure and recovers on later valid input', () => {
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: { ...closure, status: 'approved' }, plan: [plan[0]], outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('a')] } }), (error) => error.code === 'INVALID_CLOSURE');
  const valid = buildPublicationConfirmation({ closureReceipt: closure, plan: [plan[0]], outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('a')] } });
  assert.equal(valid.confirmations.length, 1);
});

test('SPC1 serialization is deterministic and integrity protected', () => {
  const receipt = buildPublicationConfirmation({ closureReceipt: closure, plan: [plan[0]], outcomeSnapshot: { mode: 'publication_outcome', closure: { receiptId: 'closure-1' }, outcomes: [outcome('a')] } });
  const first = serializePublicationConfirmation(receipt);
  const second = serializePublicationConfirmation({ confirmations: receipt.confirmations, mode: 'publication_confirmation', format: PUBLICATION_CONFIRMATION_FORMAT, closure: receipt.closure });
  assert.equal(first, second);
  assert.deepEqual(parsePublicationConfirmation(first), receipt);
  const envelope = JSON.parse(first); envelope.payload = envelope.payload.replace('publication_confirmation', 'tampered');
  assert.throws(() => parsePublicationConfirmation(JSON.stringify(envelope)), (error) => error.code === 'INTEGRITY_MISMATCH');
});
