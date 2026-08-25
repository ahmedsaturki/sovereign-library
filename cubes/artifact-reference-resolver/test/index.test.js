import test from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactReferenceError, createArtifactReferenceResolver, digestReference, parseArtifactReference } from '../src/index.js';

const DIGEST_A = `sha256:${'a'.repeat(64)}`;
const DIGEST_B = `sha256:${'b'.repeat(64)}`;

const candidates = [
  { id: 'core-1', name: 'Core.Lib', version: '1.2.3', digest: DIGEST_A, tags: ['latest', 'stable'] },
  { id: 'core-2', name: 'core.lib', version: '2.0.0', digest: DIGEST_B, tags: ['next'] },
];

test('parses canonical name, version, tag and digest references deterministically', () => {
  assert.deepEqual(parseArtifactReference('Core.Lib:1.2.3'), { raw: 'Core.Lib:1.2.3', name: 'core.lib', version: '1.2.3', tag: null, digest: null, canonical: 'core.lib@1.2.3' });
  assert.deepEqual(parseArtifactReference('core.lib@stable'), { raw: 'core.lib@stable', name: 'core.lib', version: null, tag: 'stable', digest: null, canonical: 'core.lib@stable' });
  assert.equal(parseArtifactReference(`core.lib#${DIGEST_A}`).digest, DIGEST_A);
});

test('exact version and tag resolution are deterministic', () => {
  const resolver = createArtifactReferenceResolver({ candidates });
  assert.equal(resolver.resolve('core.lib@1.2.3').matches[0].id, 'core-1');
  assert.equal(resolver.resolve('core.lib@stable').matches[0].id, 'core-1');
  assert.equal(resolver.resolve(`core.lib#${DIGEST_B}`).matches[0].id, 'core-2');
});

test('name-only resolution is allowed only when unambiguous', () => {
  const one = createArtifactReferenceResolver({ candidates: [candidates[0]] });
  assert.equal(one.resolve('core.lib').matches[0].id, 'core-1');
  const many = createArtifactReferenceResolver({ candidates });
  assert.throws(() => many.resolve('core.lib'), { code: 'AMBIGUOUS_REFERENCE', statusCode: 409 });
});

test('not-found and malformed references fail closed', () => {
  const resolver = createArtifactReferenceResolver({ candidates });
  assert.throws(() => resolver.resolve('missing.lib@1.0.0'), { code: 'REFERENCE_NOT_FOUND', statusCode: 404 });
  assert.throws(() => resolver.resolve('core.lib#nope'), { code: 'INVALID_DIGEST' });
});

test('accessors and circular candidate inputs fail before getter evaluation', () => {
  let evaluated = false;
  const accessor = {};
  Object.defineProperty(accessor, 'name', { get() { evaluated = true; return 'core.lib'; } });
  assert.throws(() => createArtifactReferenceResolver({ candidates: [accessor] }), { code: 'ACCESSOR_INPUT' });
  assert.equal(evaluated, false);
  const circular = { name: 'core.lib' };
  circular.self = circular;
  assert.throws(() => createArtifactReferenceResolver({ candidates: [circular] }), { code: 'CIRCULAR_INPUT' });
});

test('duplicate candidate identity, bounds and recovery are deterministic', () => {
  assert.throws(() => createArtifactReferenceResolver({ candidates: [candidates[0], candidates[0]] }), { code: 'DUPLICATE_CANDIDATE' });
  const resolver = createArtifactReferenceResolver({ limits: { maxCandidates: 1 }, candidates: [candidates[0]] });
  assert.throws(() => resolver.setCandidates(candidates), { code: 'LIMIT_EXCEEDED' });
  assert.equal(resolver.resolve('core.lib@1.2.3').matches[0].id, 'core-1');
});

test('snapshots are immutable and caller inputs are not mutated', () => {
  const input = candidates.map(candidate => ({ ...candidate, tags: [...candidate.tags] }));
  const resolver = createArtifactReferenceResolver({ candidates: input });
  const snapshot = resolver.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.candidates), true);
  assert.deepEqual(input[0].tags, ['latest', 'stable']);
  assert.equal(resolver.resolve('core.lib@stable').reference.canonical, 'core.lib@stable');
});

test('digestReference is stable for the normalized reference', () => {
  assert.equal(digestReference('Core.Lib@1.2.3'), digestReference('core.lib:1.2.3'));
  assert.match(digestReference('core.lib@stable'), /^sha256:[a-f0-9]{64}$/u);
});

test('errors remain typed and immutable', () => {
  try {
    parseArtifactReference('bad value');
    assert.fail('expected error');
  } catch (error) {
    assert.ok(error instanceof ArtifactReferenceError);
    assert.equal(Object.isFrozen(error), true);
    assert.equal(error.name, 'ArtifactReferenceError');
  }
});
