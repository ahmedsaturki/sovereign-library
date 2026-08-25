import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleaseSnapshot, parseReleaseSnapshot, serializeReleaseSnapshot } from '../src/index.js';

const digest = (hex = 'a') => `sha256:${hex.repeat(64).slice(0, 64)}`;
const candidate = (id, version = '1.0.0', admissionVerdict = 'eligible') => ({ id, version, digest: digest(id === 'b' ? 'b' : 'a'), admissionVerdict, evidenceRefs: [`digest:${id}`] });

test('snapshot ordering is deterministic and verdict/counts are immutable', () => {
  const snapshot = buildReleaseSnapshot([candidate('b'), candidate('a')]);
  assert.deepEqual(snapshot.candidates.map((item) => item.id), ['a', 'b']);
  assert.deepEqual(snapshot.counts, { candidates: 2, eligible: 2, blocked: 0 });
  assert.equal(snapshot.verdict, 'release_ready');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.throws(() => snapshot.candidates.push({}), TypeError);
});

test('blocked candidates are represented without mutation', () => {
  const source = candidate('a', '1.2.3', 'blocked');
  const snapshot = buildReleaseSnapshot([source]);
  assert.equal(snapshot.verdict, 'contains_blocked');
  assert.equal(snapshot.counts.blocked, 1);
  assert.equal(source.version, '1.2.3');
});

test('duplicates and malformed identity/version/digest/admission fail closed', () => {
  assert.throws(() => buildReleaseSnapshot([candidate('a'), candidate('a', '2.0.0')]), (error) => error.code === 'DUPLICATE_CANDIDATE');
  assert.throws(() => buildReleaseSnapshot([{ ...candidate('a'), id: 'bad id' }]), (error) => error.code === 'INVALID_ID');
  assert.throws(() => buildReleaseSnapshot([{ ...candidate('a'), version: '1.0' }]), (error) => error.code === 'INVALID_VERSION');
  assert.throws(() => buildReleaseSnapshot([{ ...candidate('a'), digest: 'sha256:bad' }]), (error) => error.code === 'INVALID_DIGEST');
  assert.throws(() => buildReleaseSnapshot([{ ...candidate('a'), admissionVerdict: 'unknown' }]), (error) => error.code === 'INVALID_ADMISSION');
});

test('accessors, circular values, bounds and recovery are deterministic', () => {
  const accessor = {};
  Object.defineProperty(accessor, 'id', { get() { throw new Error('getter should not run'); } });
  assert.throws(() => buildReleaseSnapshot([accessor]), (error) => error.code === 'ACCESSOR_INPUT');
  const circular = candidate('a'); circular.self = circular;
  assert.throws(() => buildReleaseSnapshot([circular]), (error) => error.code === 'CIRCULAR_INPUT');
  assert.throws(() => buildReleaseSnapshot([candidate('a')], { maxEvidence: -1 }), (error) => error.code === 'INVALID_LIMIT');
  assert.equal(buildReleaseSnapshot([candidate('ok')]).verdict, 'release_ready');
});

test('evidence is bounded and serialization is deterministic/integrity-protected', () => {
  const a = candidate('a'); a.evidenceRefs = ['one', 'two'];
  const snapshot = buildReleaseSnapshot([a], { maxEvidence: 1 });
  assert.deepEqual(snapshot.candidates[0].evidenceRefs, ['one']);
  const first = serializeReleaseSnapshot(snapshot);
  const second = serializeReleaseSnapshot(buildReleaseSnapshot([candidate('a')], { maxEvidence: 1 }));
  assert.equal(first.replace('one', 'digest:a'), second);
  assert.deepEqual(parseReleaseSnapshot(first), snapshot);
  const envelope = JSON.parse(first); envelope.payload = envelope.payload.replace('release_ready', 'tampered');
  assert.throws(() => parseReleaseSnapshot(JSON.stringify(envelope)), (error) => error.code === 'INTEGRITY_MISMATCH');
});
