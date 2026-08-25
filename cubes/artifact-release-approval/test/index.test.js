import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleaseApproval, parseReleaseApproval, serializeReleaseApproval } from '../src/index.js';

const snapshot = { snapshotId: 'release-snapshot-1', snapshotChecksum: 'a'.repeat(64) };
const scopes = [{ id: 'security', required: true }, { id: 'ops', required: true }, { id: 'optional-note', required: false }];
const decision = (id, reviewerId, scopeId, state = 'approve') => ({ id, reviewerId, scopeId, state, evidenceRefs: [`evidence:${id}`] });

test('required approvals produce approved status deterministically and immutably', () => {
  const record = buildReleaseApproval(snapshot, scopes, [
    decision('d2', 'bob', 'ops'), decision('d1', 'alice', 'security'), decision('d3', 'alice', 'optional-note', 'abstain'),
  ]);
  assert.equal(record.status, 'approved');
  assert.deepEqual(record.scopeStates, [
    { scopeId: 'ops', status: 'approved' },
    { scopeId: 'security', status: 'approved' },
  ]);
  assert.equal(Object.isFrozen(record), true);
  assert.throws(() => record.decisions.push({}), TypeError);
});

test('pending and rejected semantics are deterministic', () => {
  const pending = buildReleaseApproval(snapshot, scopes, [decision('d1', 'alice', 'security')]);
  assert.equal(pending.status, 'pending');
  const rejected = buildReleaseApproval(snapshot, scopes, [decision('d1', 'alice', 'security', 'reject'), decision('d2', 'bob', 'ops')]);
  assert.equal(rejected.status, 'rejected');
});

test('duplicate ids, reviewer/scope conflicts, unknown scopes, invalid state and bad snapshot fail closed', () => {
  assert.throws(() => buildReleaseApproval(snapshot, scopes, [decision('d', 'alice', 'security'), decision('d', 'bob', 'ops')]), (error) => error.code === 'DUPLICATE_DECISION');
  assert.throws(() => buildReleaseApproval(snapshot, scopes, [decision('d1', 'alice', 'security'), decision('d2', 'alice', 'security')]), (error) => error.code === 'CONFLICTING_DECISION');
  assert.throws(() => buildReleaseApproval(snapshot, scopes, [decision('d1', 'alice', 'unknown')]), (error) => error.code === 'UNKNOWN_SCOPE');
  assert.throws(() => buildReleaseApproval(snapshot, scopes, [decision('d1', 'alice', 'security', 'maybe')]), (error) => error.code === 'INVALID_STATE');
  assert.throws(() => buildReleaseApproval({ ...snapshot, snapshotChecksum: 'bad' }, scopes, []), (error) => error.code === 'INVALID_SNAPSHOT_CHECKSUM');
});

test('accessors, circular values, invalid limits and recovery are deterministic', () => {
  const accessor = {};
  Object.defineProperty(accessor, 'id', { get() { throw new Error('getter should not run'); } });
  assert.throws(() => buildReleaseApproval(snapshot, scopes, [accessor]), (error) => error.code === 'ACCESSOR_INPUT');
  const circular = decision('d1', 'alice', 'security'); circular.self = circular;
  assert.throws(() => buildReleaseApproval(snapshot, scopes, [circular]), (error) => error.code === 'CIRCULAR_INPUT');
  assert.throws(() => buildReleaseApproval(snapshot, scopes, [], { maxEvidence: -1 }), (error) => error.code === 'INVALID_LIMIT');
  assert.equal(buildReleaseApproval(snapshot, scopes, []).status, 'pending');
});

test('serialization is deterministic and integrity protected', () => {
  const record = buildReleaseApproval(snapshot, scopes, [decision('d1', 'alice', 'security'), decision('d2', 'bob', 'ops')]);
  const first = serializeReleaseApproval(record);
  const second = serializeReleaseApproval(buildReleaseApproval(snapshot, scopes, [decision('d2', 'bob', 'ops'), decision('d1', 'alice', 'security')]));
  assert.equal(first, second);
  assert.deepEqual(parseReleaseApproval(first), record);
  const envelope = JSON.parse(first); envelope.payload = envelope.payload.replace('approved', 'tampered');
  assert.throws(() => parseReleaseApproval(JSON.stringify(envelope)), (error) => error.code === 'INTEGRITY_MISMATCH');
});
