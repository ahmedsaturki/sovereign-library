import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReport, reconcileSnapshots, serializeReport } from '../src/index.js';

test('equal snapshots produce deterministic immutable reports', () => {
  const left = { records: [{ id: 'a', digest: 'sha256:1', version: '1', lifecycle: 'live', parents: [] }] };
  const right = { records: [{ id: 'a', digest: 'sha256:1', version: '1', lifecycle: 'live', parents: [] }] };
  const report = reconcileSnapshots(left, right);
  assert.equal(report.equal, true);
  assert.equal(report.counts.mismatches, 0);
  assert.equal(Object.isFrozen(report), true);
  assert.throws(() => { report.issues.push({}); }, TypeError);
  assert.equal(serializeReport(report), serializeReport(reconcileSnapshots(right, left)));
});

test('missing, extra, digest, version, lifecycle, and lineage mismatches classify deterministically', () => {
  const left = { records: [
    { id: 'a', digest: 'sha256:1', version: '1', lifecycle: 'live', parents: [] },
    { id: 'b', digest: 'sha256:2', version: '1', lifecycle: 'live', parents: ['a'] },
  ] };
  const right = { records: [
    { id: 'a', digest: 'sha256:9', version: '2', lifecycle: 'expired', parents: ['root'] },
    { id: 'c', digest: 'sha256:3', version: '1', lifecycle: 'live', parents: [] },
  ] };
  const report = reconcileSnapshots(left, right);
  assert.equal(report.equal, false);
  assert.deepEqual(report.issues.map(issue => issue.category), [
    'DIGEST_MISMATCH',
    'MISSING_RIGHT',
    'EXTRA_RIGHT',
    'LIFECYCLE_MISMATCH',
    'LINEAGE_MISMATCH',
    'VERSION_MISMATCH',
  ]);
});

test('duplicate identities and accessors fail closed without mutation', () => {
  const duplicate = { records: [{ id: 'a' }, { id: 'a' }] };
  assert.throws(() => reconcileSnapshots(duplicate, { records: [] }), error => error.code === 'DUPLICATE_ID');
  const accessor = { records: [] };
  Object.defineProperty(accessor, 'records', { get() { throw new Error('getter evaluated'); } });
  assert.throws(() => reconcileSnapshots(accessor, { records: [] }), error => error.code === 'ACCESSOR_INPUT');
});

test('report serialization round-trips and corruption is rejected', () => {
  const report = reconcileSnapshots({ records: [{ id: 'a', digest: 'sha256:1' }] }, { records: [{ id: 'b', digest: 'sha256:2' }] });
  const serialized = serializeReport(report);
  assert.deepEqual(parseReport(serialized), report);
  const envelope = JSON.parse(serialized);
  envelope.payload = envelope.payload.replace('MISSING_RIGHT', 'TAMPERED');
  assert.throws(() => parseReport(JSON.stringify(envelope)), error => error.code === 'INTEGRITY_MISMATCH');
});

test('bounds reject oversized inputs and recover on later valid input', () => {
  const tooLarge = { records: [{ id: 'a' }, { id: 'b' }] };
  assert.throws(() => reconcileSnapshots(tooLarge, { records: [] }, { maxRecords: 1 }), error => error.code === 'INVALID_LIMIT');
  const report = reconcileSnapshots({ records: [{ id: 'a' }] }, { records: [{ id: 'a' }] }, { maxRecords: 1 });
  assert.equal(report.equal, true);
});
