import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAdmission, parseAdmission, serializeAdmission } from '../src/index.js';

test('required and optional clauses produce deterministic eligibility', () => {
  const report = evaluateAdmission(
    { id: 'a', digest: 'sha256:x', version: '2.1.0', lifecycle: 'live', compliant: true },
    { clauses: [
      { id: 'compliance', kind: 'required', category: 'compliance', field: 'compliant', predicate: 'equals', expected: true },
      { id: 'version', kind: 'required', category: 'version', field: 'version', predicate: 'semverGte', expected: '2.0.0' },
      { id: 'note', kind: 'optional', category: 'metadata', field: 'note', predicate: 'exists', expected: true },
    ] },
  );
  assert.equal(report.verdict, 'eligible');
  assert.equal(report.counts.failed, 1);
  assert.equal(report.counts.blocking, 0);
  assert.equal(report.reasons.find((r) => r.clauseId === 'note').blocking, false);
});

test('required failure blocks and reasons are immutable', () => {
  const report = evaluateAdmission(
    { id: 'a', lifecycle: 'expired' },
    { clauses: [{ id: 'live', kind: 'required', category: 'lifecycle', field: 'lifecycle', predicate: 'equals', expected: 'live' }] },
  );
  assert.equal(report.verdict, 'blocked');
  assert.equal(report.counts.blocking, 1);
  assert.equal(Object.isFrozen(report), true);
  assert.throws(() => report.reasons.push({}), TypeError);
});

test('membership and semver predicates are deterministic', () => {
  const eligible = evaluateAdmission(
    { id: 'a', version: '1.5.0', channel: 'stable' },
    { clauses: [
      { id: 'version', kind: 'required', category: 'version', field: 'version', predicate: 'semverGte', expected: '1.4.0' },
      { id: 'channel', kind: 'required', category: 'custom', field: 'channel', predicate: 'in', expected: ['stable', 'beta'] },
    ] },
  );
  assert.equal(eligible.verdict, 'eligible');
  const blocked = evaluateAdmission(
    { id: 'a', version: '1.3.9' },
    { clauses: [{ id: 'version', kind: 'required', category: 'version', field: 'version', predicate: 'semverGte', expected: '1.4.0' }] },
  );
  assert.equal(blocked.verdict, 'blocked');
});

test('duplicates, accessors, circular values and invalid configuration fail closed', () => {
  assert.throws(() => evaluateAdmission({ id: 'a' }, { clauses: [
    { id: 'x', kind: 'required', category: 'custom', field: 'x', predicate: 'exists', expected: true },
    { id: 'x', kind: 'optional', category: 'custom', field: 'y', predicate: 'exists', expected: true },
  ] }), (e) => e.code === 'DUPLICATE_CLAUSE');
  const config = {};
  Object.defineProperty(config, 'clauses', { get() { throw new Error('getter evaluated'); } });
  assert.throws(() => evaluateAdmission({ id: 'a' }, config), (e) => e.code === 'ACCESSOR_INPUT');
  const artifact = { id: 'a' }; artifact.self = artifact;
  assert.throws(() => evaluateAdmission(artifact, { clauses: [] }), (e) => e.code === 'CIRCULAR_INPUT');
  assert.throws(() => evaluateAdmission({ id: 'a', version: 'bad' }, { clauses: [{ id: 'v', kind: 'required', category: 'version', field: 'version', predicate: 'semverGte', expected: '1.0.0' }] }), (e) => e.code === 'INVALID_VERSION');
});

test('serialization is deterministic and integrity protected', () => {
  const report = evaluateAdmission({ id: 'a', lifecycle: 'live' }, { clauses: [{ id: 'live', kind: 'required', category: 'lifecycle', field: 'lifecycle', predicate: 'equals', expected: 'live' }] });
  const wire = serializeAdmission(report);
  assert.deepEqual(parseAdmission(wire), report);
  const envelope = JSON.parse(wire); envelope.payload = envelope.payload.replace('eligible', 'tampered');
  assert.throws(() => parseAdmission(JSON.stringify(envelope)), (e) => e.code === 'INTEGRITY_MISMATCH');
});

test('recovery works after a rejected evaluation', () => {
  assert.throws(() => evaluateAdmission({ id: 'a' }, { clauses: [{ id: 'bad', kind: 'required', category: 'custom', field: 'x', predicate: 'wat', expected: true }] }));
  const report = evaluateAdmission({ id: 'ok', lifecycle: 'live' }, { clauses: [{ id: 'live', kind: 'required', category: 'lifecycle', field: 'lifecycle', predicate: 'equals', expected: 'live' }] });
  assert.equal(report.verdict, 'eligible');
});
