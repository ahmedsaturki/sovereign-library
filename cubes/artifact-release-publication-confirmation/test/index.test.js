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
const closureReference = {
  receiptId: closure.receiptId, snapshotId: closure.snapshotId,
  snapshotChecksum: closure.snapshotChecksum, approvalId: closure.approvalId,
  approvalChecksum: closure.approvalChecksum, status: closure.status,
};
const plan = [
  { intentId: 'a', idempotencyKey: 'idem-a', destinationId: 'dest-a', artifactId: 'artifact-a', artifactDigest: digest },
  { intentId: 'b', idempotencyKey: 'idem-b', destinationId: 'dest-b', artifactId: 'artifact-b', artifactDigest: digest },
];
const outcome = (id = 'a', state = 'succeeded', overrides = {}) => ({
  intentId: id, idempotencyKey: `idem-${id}`, destinationId: `dest-${id}`, artifactId: `artifact-${id}`, artifactDigest: digest,
  state, evidenceRefs: ['evidence:b', 'evidence:a'], committedAt: '2026-08-25T12:00:00Z', ...overrides,
});
const snapshot = (outcomes, overrides = {}) => ({
  mode: 'publication_outcome', closure: closureReference, outcomes, ...overrides,
});

function build(outcomes, options = {}) {
  return buildPublicationConfirmation({ closureReceipt: closure, plan, outcomeSnapshot: snapshot(outcomes), ...options });
}

test('builds deterministic immutable confirmations and preserves bounded caller metadata', () => {
  const one = build([outcome('b'), outcome('a')], { metadata: { source: 'executor', ticket: 'release-77' } });
  const two = build([outcome('a'), outcome('b')], { metadata: { ticket: 'release-77', source: 'executor' } });
  assert.deepEqual(one, two);
  assert.equal(one.confirmations[0].intentId, 'a');
  assert.deepEqual(one.metadata, { source: 'executor', ticket: 'release-77' });
  assert.equal(Object.isFrozen(one), true);
  assert.equal(Object.isFrozen(one.closure), true);
  assert.equal(Object.isFrozen(one.metadata), true);
  assert.equal(Object.isFrozen(one.confirmations), true);
});

test('accepts all explicit execution states without side effects', () => {
  for (const state of ['succeeded', 'skipped_idempotent', 'failed']) {
    const receipt = build([outcome('a', state)]);
    assert.equal(receipt.confirmations[0].state, state);
  }
});

test('requires the exact originating closure identity', () => {
  for (const field of ['snapshotId', 'snapshotChecksum', 'approvalId', 'approvalChecksum']) {
    const mismatched = { ...closureReference, [field]: field === 'snapshotChecksum' || field === 'approvalChecksum' ? 'sha256:' + 'c'.repeat(64) : `other-${field}` };
    assert.throws(() => build([outcome('a')], { }), (error) => error.code === 'CLOSURE_MISMATCH');
    assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan: [plan[0]], outcomeSnapshot: snapshot([outcome('a')], { closure: mismatched }) }), (error) => error.code === 'CLOSURE_MISMATCH');
  }
});

test('rejects closure mismatch, unknown intent, duplicate confirmation, and plan mismatches', () => {
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan, outcomeSnapshot: snapshot([outcome('a')], { closure: { ...closureReference, receiptId: 'other' } }) }), (error) => error.code === 'CLOSURE_MISMATCH');
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan, outcomeSnapshot: snapshot([outcome('missing')]) }), (error) => error.code === 'OUTCOME_NOT_IN_PLAN');
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan, outcomeSnapshot: snapshot([outcome('a'), outcome('a')]) }), (error) => error.code === 'DUPLICATE_CONFIRMATION');
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan, outcomeSnapshot: snapshot([outcome('a', 'succeeded', { destinationId: 'wrong' })]) }), (error) => error.code === 'OUTCOME_PLAN_MISMATCH');
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: closure, plan: [{ ...plan[0], artifactDigest: 'sha256:' + 'c'.repeat(64) }], outcomeSnapshot: snapshot([outcome('a')]) }), (error) => error.code === 'OUTCOME_PLAN_MISMATCH');
});

test('rejects invalid states, malformed timestamps, accessors, circular data, and oversized evidence', () => {
  assert.throws(() => build([outcome('a', 'unknown')]), (error) => error.code === 'INVALID_STATE');
  assert.throws(() => build([outcome('a', 'succeeded', { committedAt: '2026-08-25' })]), (error) => error.code === 'INVALID_TIMESTAMP');
  const accessor = { ...outcome('a') }; Object.defineProperty(accessor, 'state', { get() { throw new Error('getter must not execute'); } });
  assert.throws(() => build([accessor]), (error) => error.code === 'ACCESSOR_INPUT');
  const circular = outcome('a'); circular.evidenceRefs.push(circular);
  assert.throws(() => build([circular]), (error) => error.code === 'CIRCULAR_INPUT');
  assert.throws(() => build([outcome('a', 'succeeded', { evidenceRefs: Array.from({ length: 33 }, (_, i) => `e-${i}`) })]), (error) => error.code === 'LIMIT_EXCEEDED');
});

test('rejects invalid metadata and oversized confirmation payloads', () => {
  assert.throws(() => build([outcome('a')], { metadata: [] }), (error) => error.code === 'INVALID_METADATA');
  assert.throws(() => build([outcome('a')], { metadata: { large: 'x'.repeat(8193) } }), (error) => error.code === 'LIMIT_EXCEEDED');
  const hugeEvidence = outcome('a', 'succeeded', { commitEvidence: 'x'.repeat(4097) });
  assert.throws(() => build([hugeEvidence]), (error) => error.code === 'LIMIT_EXCEEDED');
});

test('rejects non-closed closure and recovers on later valid input', () => {
  assert.throws(() => buildPublicationConfirmation({ closureReceipt: { ...closure, status: 'approved' }, plan: [plan[0]], outcomeSnapshot: snapshot([outcome('a')]) }), (error) => error.code === 'INVALID_CLOSURE');
  const valid = build([outcome('a')]);
  assert.equal(valid.confirmations.length, 1);
});

test('does not require all plan intents when executor produced a partial terminal outcome snapshot', () => {
  const receipt = build([outcome('a', 'failed')]);
  assert.deepEqual(receipt.confirmations.map((item) => item.intentId), ['a']);
});

test('SPC1 serialization is deterministic and integrity protected', () => {
  const receipt = build([outcome('a')]);
  const first = serializePublicationConfirmation(receipt);
  const second = serializePublicationConfirmation({ confirmations: receipt.confirmations, mode: 'publication_confirmation', format: PUBLICATION_CONFIRMATION_FORMAT, closure: receipt.closure, metadata: null });
  assert.equal(first, second);
  assert.deepEqual(parsePublicationConfirmation(first), receipt);
  const envelope = JSON.parse(first); envelope.payload = envelope.payload.replace('publication_confirmation', 'tampered');
  assert.throws(() => parsePublicationConfirmation(JSON.stringify(envelope)), (error) => error.code === 'INTEGRITY_MISMATCH');
});

test('rejects malformed serialization and recovers cleanly', () => {
  assert.throws(() => parsePublicationConfirmation('{bad'), (error) => error.code === 'MALFORMED_SERIALIZATION');
  const receipt = build([outcome('a')]);
  assert.equal(parsePublicationConfirmation(serializePublicationConfirmation(receipt)).confirmations.length, 1);
});
