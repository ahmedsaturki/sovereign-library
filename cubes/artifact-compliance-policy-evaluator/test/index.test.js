import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCompliance, normalizePolicies, parseCompliance, serializeCompliance } from '../src/index.js';

test('rules normalize deterministically and duplicate ids fail closed', () => {
  const rules = normalizePolicies([
    { id: 'z', category: 'digest', severity: 'high', field: 'digest', operator: 'equals', value: 'sha256:2' },
    { id: 'a', category: 'version', severity: 'medium', field: 'version', operator: 'gte', value: 2 },
  ]);
  assert.deepEqual(rules.map((r) => r.id), ['a', 'z']);
  assert.throws(() => normalizePolicies([
    { id: 'a', category: 'digest', severity: 'high', field: 'digest', operator: 'equals', value: 'x' },
    { id: 'a', category: 'digest', severity: 'high', field: 'digest', operator: 'equals', value: 'y' },
  ]), (e) => e.code === 'DUPLICATE_RULE');
});

test('compliance findings are deterministic and immutable', () => {
  const artifacts = [
    { id: 'b', digest: 'sha256:2', version: 1, lifecycle: 'expired', metadata: { env: 'dev' } },
    { id: 'a', digest: 'sha256:1', version: 2, lifecycle: 'live', metadata: { env: 'prod' } },
  ];
  const rules = [
    { id: 'r-digest', category: 'digest', severity: 'high', field: 'digest', operator: 'equals', value: 'sha256:1' },
    { id: 'r-live', category: 'lifecycle', severity: 'critical', field: 'lifecycle', operator: 'equals', value: 'live' },
    { id: 'r-version', category: 'version', severity: 'medium', field: 'version', operator: 'gte', value: 2 },
  ];
  const report = evaluateCompliance(artifacts, rules);
  assert.equal(report.verdict, 'non_compliant');
  assert.deepEqual(report.findings.map((f) => [f.ruleId, f.artifactId]), [['r-live', 'b'], ['r-digest', 'b'], ['r-version', 'b']]);
  assert.equal(Object.isFrozen(report), true);
  assert.throws(() => report.findings.push({}), TypeError);
  assert.equal(artifacts[0].version, 1);
});

test('membership, existence, numeric and regex predicates work deterministically', () => {
  const artifacts = [{ id: 'a', metadata: { env: 'prod', score: 9, owner: 'alice' } }];
  const rules = [
    { id: 'env', category: 'metadata', severity: 'low', field: 'metadata.env', operator: 'in', value: ['dev', 'prod'] },
    { id: 'owner', category: 'metadata', severity: 'low', field: 'metadata.owner', operator: 'matches', value: '^a' },
    { id: 'score', category: 'constraint', severity: 'low', field: 'metadata.score', operator: 'gte', value: 10 },
    { id: 'missing', category: 'constraint', severity: 'medium', field: 'metadata.region', operator: 'exists', value: true },
  ];
  const report = evaluateCompliance(artifacts, rules);
  assert.deepEqual(report.findings.map((f) => f.ruleId), ['score', 'missing']);
});

test('invalid regex, accessors, circular values, duplicates, and bounds fail closed', () => {
  assert.throws(() => normalizePolicies([{ id: 'r', category: 'metadata', severity: 'low', field: 'name', operator: 'matches', value: '(' }]), (e) => e.code === 'INVALID_REGEX');
  assert.throws(() => normalizePolicies([{ id: 'r', category: 'metadata', severity: 'low', field: 'name', operator: 'matches', value: '(a+)+$' }]), (e) => e.code === 'INVALID_REGEX');
  const rule = {};
  Object.defineProperty(rule, 'id', { get() { throw new Error('getter evaluated'); } });
  assert.throws(() => normalizePolicies([rule]), (e) => e.code === 'ACCESSOR_INPUT');
  const artifact = { id: 'a' };
  artifact.self = artifact;
  assert.throws(() => evaluateCompliance([artifact], []), (e) => e.code === 'CIRCULAR_INPUT');
  assert.throws(() => evaluateCompliance([{ id: 'a' }, { id: 'a' }], []), (e) => e.code === 'DUPLICATE_ARTIFACT');
  assert.throws(() => evaluateCompliance([{ id: 'a' }], [], { maxFindings: -1 }), (e) => e.code === 'INVALID_LIMIT');
});

test('report serialization is deterministic and integrity protected', () => {
  const a = evaluateCompliance([{ id: 'a', version: 1 }], [{ id: 'r', category: 'version', severity: 'high', field: 'version', operator: 'gte', value: 2 }]);
  const sa = serializeCompliance(a);
  const sb = serializeCompliance(evaluateCompliance([{ id: 'a', version: 1 }], [{ id: 'r', category: 'version', severity: 'high', field: 'version', operator: 'gte', value: 2 }]));
  assert.equal(sa, sb);
  assert.deepEqual(parseCompliance(sa), a);
  const envelope = JSON.parse(sa);
  envelope.payload = envelope.payload.replace('non_compliant', 'tampered');
  assert.throws(() => parseCompliance(JSON.stringify(envelope)), (e) => e.code === 'INTEGRITY_MISMATCH');
});

test('later valid evaluation recovers after rejected input', () => {
  const bad = [{ id: 'a' }];
  bad[0].self = bad[0];
  assert.throws(() => evaluateCompliance(bad, []));
  const good = evaluateCompliance([{ id: 'ok', lifecycle: 'live' }], [{ id: 'r', category: 'lifecycle', severity: 'low', field: 'lifecycle', operator: 'equals', value: 'live' }]);
  assert.equal(good.verdict, 'compliant');
});
