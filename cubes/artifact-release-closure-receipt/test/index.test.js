import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleaseClosure, parseReleaseClosure, serializeReleaseClosure } from '../src/index.js';

const snapshot = { id: 'snap-1', checksum: 'a'.repeat(64) };
const approval = { id: 'approval-1', checksum: 'b'.repeat(64), status: 'approved', snapshotId: 'snap-1', snapshotChecksum: 'a'.repeat(64) };

test('closure links exact approved snapshot deterministically and is immutable', () => {
  const receipt = buildReleaseClosure(snapshot, approval, { receiptId: 'closure-1', metadata: { release: '1.0.0' }, evidenceRefs: ['approval:1'] });
  assert.equal(receipt.status, 'closed');
  assert.deepEqual(receipt.snapshot, snapshot);
  assert.deepEqual(receipt.approval, { id: 'approval-1', checksum: 'b'.repeat(64), status: 'approved' });
  assert.equal(Object.isFrozen(receipt), true);
  assert.throws(() => receipt.evidenceRefs.push('x'), TypeError);
});

test('mismatched snapshot and non-approved decision fail closed', () => {
  assert.throws(() => buildReleaseClosure(snapshot, { ...approval, status: 'pending' }), (error) => error.code === 'NOT_APPROVED');
  assert.throws(() => buildReleaseClosure(snapshot, { ...approval, snapshotId: 'other' }), (error) => error.code === 'SNAPSHOT_MISMATCH');
  assert.throws(() => buildReleaseClosure(snapshot, { ...approval, snapshotChecksum: 'c'.repeat(64) }), (error) => error.code === 'SNAPSHOT_MISMATCH');
});

test('accessors, circular metadata, invalid ids/checksums and limits fail closed with recovery', () => {
  const accessor = {};
  Object.defineProperty(accessor, 'id', { get() { throw new Error('getter should not run'); } });
  assert.throws(() => buildReleaseClosure(accessor, approval), (error) => error.code === 'ACCESSOR_INPUT');
  const metadata = {}; metadata.self = metadata;
  assert.throws(() => buildReleaseClosure(snapshot, approval, { metadata }), (error) => error.code === 'CIRCULAR_INPUT');
  assert.throws(() => buildReleaseClosure({ ...snapshot, checksum: 'bad' }, approval), (error) => error.code === 'INVALID_CHECKSUM');
  assert.equal(buildReleaseClosure(snapshot, approval).status, 'closed');
});

test('serialization is deterministic and integrity protected', () => {
  const first = serializeReleaseClosure(buildReleaseClosure(snapshot, approval, { receiptId: 'closure-1', metadata: { release: '1.0.0' } }));
  const second = serializeReleaseClosure(buildReleaseClosure({ id: 'snap-1', checksum: 'a'.repeat(64) }, { id: 'approval-1', checksum: 'b'.repeat(64), status: 'approved', snapshotId: 'snap-1', snapshotChecksum: 'a'.repeat(64) }, { receiptId: 'closure-1', metadata: { release: '1.0.0' } }));
  assert.equal(first, second);
  const parsed = parseReleaseClosure(first); assert.equal(parsed.receiptId, 'closure-1');
  const envelope = JSON.parse(first); envelope.payload = envelope.payload.replace('closed', 'tampered');
  assert.throws(() => parseReleaseClosure(JSON.stringify(envelope)), (error) => error.code === 'INTEGRITY_MISMATCH');
});
