import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSnapshots, parseAudit, serializeAudit } from '../src/index.js';

test('classifies unchanged, changed, added, and removed deterministically', () => {
  const baseline = { records: [
    { id: 'a', digest: 'sha256:1', version: '1', lifecycle: 'live', parents: [] },
    { id: 'b', digest: 'sha256:2', version: '1', lifecycle: 'live', parents: ['a'] },
    { id: 'd', digest: 'sha256:4', version: '1', lifecycle: 'live', parents: [] },
  ] };
  const current = { records: [
    { id: 'a', digest: 'sha256:1', version: '1', lifecycle: 'live', parents: [] },
    { id: 'b', digest: 'sha256:9', version: '2', lifecycle: 'expired', parents: ['root'] },
    { id: 'c', digest: 'sha256:3', version: '1', lifecycle: 'live', parents: [] },
  ] };
  const report = auditSnapshots(baseline, current);
  assert.deepEqual(report.findings.map(f => [f.id, f.state]), [
    ['b', 'changed'], ['d', 'removed'], ['c', 'added'], ['a', 'unchanged'],
  ]);
  assert.equal(report.counts.findings, 4);
});

test('changed findings expose deterministic drift categories', () => {
  const report = auditSnapshots(
    { records: [{ id: 'a', digest: 'sha256:1', version: '1', lifecycle: 'live', parents: [] }] },
    { records: [{ id: 'a', digest: 'sha256:2', version: '2', lifecycle: 'expired', parents: ['root'] }] },
  );
  assert.deepEqual(report.findings[0].changes.map(c => c.category), ['DIGEST_DRIFT', 'VERSION_DRIFT', 'LIFECYCLE_DRIFT', 'LINEAGE_DRIFT']);
  assert.equal(report.findings[0].severity, 'critical');
});

test('reports are immutable and input is not mutated', () => {
  const baseline = { records: [{ id: 'a', parents: ['z', 'a'] }] };
  const current = { records: [{ id: 'a', parents: ['a', 'z'] }] };
  const report = auditSnapshots(baseline, current);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.findings), true);
  assert.deepEqual(baseline.records[0].parents, ['z', 'a']);
  assert.throws(() => report.findings.push({}), TypeError);
});

test('duplicates, accessors, circular input, and bounds fail closed', () => {
  assert.throws(() => auditSnapshots({ records: [{ id: 'a' }, { id: 'a' }] }, { records: [] }), e => e.code === 'DUPLICATE_ID');
  const accessor = { records: [] };
  Object.defineProperty(accessor, 'records', { get() { throw new Error('getter evaluated'); } });
  assert.throws(() => auditSnapshots(accessor, { records: [] }), e => e.code === 'ACCESSOR_INPUT');
  const circular = { records: [] };
  circular.self = circular;
  assert.throws(() => auditSnapshots(circular, { records: [] }), e => e.code === 'INVALID_SNAPSHOT');
  assert.throws(() => auditSnapshots({ records: [{ id: 'a' }, { id: 'b' }] }, { records: [] }, { maxRecords: 1 }), e => e.code === 'INVALID_LIMIT');
  const valid = auditSnapshots({ records: [{ id: 'a' }] }, { records: [{ id: 'a' }] }, { maxRecords: 1 });
  assert.equal(valid.counts.findings, 1);
});

test('report serialization is deterministic and integrity protected', () => {
  const a = auditSnapshots({ records: [{ id: 'b' }, { id: 'a' }] }, { records: [{ id: 'a' }, { id: 'b' }] });
  const b = auditSnapshots({ records: [{ id: 'a' }, { id: 'b' }] }, { records: [{ id: 'b' }, { id: 'a' }] });
  const sa = serializeAudit(a);
  const sb = serializeAudit(b);
  assert.equal(sa, sb);
  assert.deepEqual(parseAudit(sa), a);
  const envelope = JSON.parse(sa);
  envelope.payload = envelope.payload.replace('UNCHANGED', 'TAMPERED');
  assert.throws(() => parseAudit(JSON.stringify(envelope)), e => e.code === 'INTEGRITY_MISMATCH');
});
