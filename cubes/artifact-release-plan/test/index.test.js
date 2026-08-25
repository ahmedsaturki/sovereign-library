import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleasePlan, parseReleasePlan, serializeReleasePlan } from '../src/index.js';

const artifact = (id, evidenceRefs = []) => ({ id, admissionVerdict: 'eligible', evidenceRefs });

test('dependency-first ordering is deterministic and immutable', () => {
  const artifacts = [artifact('b'), artifact('a'), artifact('c')];
  const dependencies = [{ from: 'a', to: 'c' }, { from: 'b', to: 'c' }];
  const plan = buildReleasePlan(artifacts, dependencies);
  assert.deepEqual(plan.order, ['a', 'b', 'c']);
  assert.deepEqual(plan.steps.map((step) => [step.step, step.artifactId, step.dependsOn]), [
    [1, 'a', []], [2, 'b', []], [3, 'c', ['a', 'b']],
  ]);
  assert.equal(Object.isFrozen(plan), true);
  assert.throws(() => plan.steps.push({}), TypeError);
  assert.equal(artifacts[0].id, 'b');
});

test('missing or blocked admission fails closed and later valid planning recovers', () => {
  assert.throws(() => buildReleasePlan([{ id: 'a' }], []), (error) => error.code === 'MISSING_ADMISSION');
  assert.throws(() => buildReleasePlan([{ id: 'a', admissionVerdict: 'blocked' }], []), (error) => error.code === 'BLOCKED_ADMISSION');
  const valid = buildReleasePlan([artifact('ok')], []);
  assert.equal(valid.verdict, 'planned');
});

test('unknown, duplicate, self, and cyclic dependencies fail closed', () => {
  assert.throws(() => buildReleasePlan([artifact('a')], [{ from: 'a', to: 'b' }]), (error) => error.code === 'UNKNOWN_ARTIFACT');
  assert.throws(() => buildReleasePlan([artifact('a')], [{ from: 'a', to: 'a' }]), (error) => error.code === 'CYCLE');
  assert.throws(() => buildReleasePlan([artifact('a'), artifact('b')], [
    { from: 'a', to: 'b' }, { from: 'a', to: 'b' },
  ]), (error) => error.code === 'DUPLICATE_DEPENDENCY');
  assert.throws(() => buildReleasePlan([artifact('a'), artifact('b')], [
    { from: 'a', to: 'b' }, { from: 'b', to: 'a' },
  ]), (error) => error.code === 'CYCLE');
});

test('bounds, accessors, circular values, and invalid limits fail closed', () => {
  assert.throws(() => buildReleasePlan([artifact('a')], [], { maxSteps: -1 }), (error) => error.code === 'INVALID_LIMIT');
  const accessor = {};
  Object.defineProperty(accessor, 'id', { get() { throw new Error('getter should not run'); } });
  assert.throws(() => buildReleasePlan([accessor], []), (error) => error.code === 'ACCESSOR_INPUT');
  const circular = { id: 'a', admissionVerdict: 'eligible' };
  circular.self = circular;
  assert.throws(() => buildReleasePlan([circular], []), (error) => error.code === 'CIRCULAR_INPUT');
});

test('evidence references are bounded and not copied as arbitrary payloads', () => {
  const refs = ['sha256:abc', 'ledger:42'];
  const plan = buildReleasePlan([artifact('a', refs)], [], { maxEvidence: 1 });
  assert.deepEqual(plan.steps[0].evidenceRefs, ['sha256:abc']);
});

test('serialization is deterministic and integrity protected', () => {
  const plan = buildReleasePlan([artifact('b'), artifact('a')], [{ from: 'a', to: 'b' }]);
  const first = serializeReleasePlan(plan);
  const second = serializeReleasePlan(buildReleasePlan([artifact('a'), artifact('b')], [{ from: 'a', to: 'b' }]));
  assert.equal(first, second);
  assert.deepEqual(parseReleasePlan(first), plan);
  const envelope = JSON.parse(first);
  envelope.payload = envelope.payload.replace('planned', 'tampered');
  assert.throws(() => parseReleasePlan(JSON.stringify(envelope)), (error) => error.code === 'INTEGRITY_MISMATCH');
});
