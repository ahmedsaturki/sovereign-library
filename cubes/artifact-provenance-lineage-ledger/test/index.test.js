import test from 'node:test';
import assert from 'node:assert/strict';
import { createProvenanceLedger, parseProvenanceSnapshot, ProvenanceError } from '../src/index.js';

test('append is deterministic and snapshots are immutable', () => {
  const ledger = createProvenanceLedger();
  const event = ledger.append({ eventId: 'e1', actor: 'agent', action: 'build', source: 'ci', parents: ['src'], derivedArtifact: 'bin', metadata: { z: 'last', a: 'first' } });
  assert.equal(event.sequence, 0);
  const snapshot = ledger.snapshot();
  assert.equal(snapshot.events[0].metadata.a, 'first');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.events[0]), true);
  assert.throws(() => { snapshot.events.push(event); }, TypeError);
});

test('duplicate events, malformed ids, and accessors fail closed without poisoning state', () => {
  const ledger = createProvenanceLedger();
  ledger.append({ eventId: 'e1', actor: 'a', action: 'x', source: 's', derivedArtifact: 'b' });
  assert.throws(() => ledger.append({ eventId: 'e1', actor: 'a', action: 'x', source: 's', derivedArtifact: 'c' }), error => error.code === 'DUPLICATE_EVENT');
  assert.throws(() => ledger.append({ eventId: 'bad id', actor: 'a', action: 'x', source: 's', derivedArtifact: 'c' }), error => error.code === 'INVALID_ID');
  const accessor = {};
  Object.defineProperty(accessor, 'eventId', { get() { throw new Error('getter evaluated'); } });
  accessor.actor = 'a'; accessor.action = 'x'; accessor.source = 's'; accessor.derivedArtifact = 'c';
  assert.throws(() => ledger.append(accessor), error => error.code === 'ACCESSOR_INPUT');
  assert.equal(ledger.stats().events, 1);
});

test('ancestors and descendants are bounded and deterministic', () => {
  const ledger = createProvenanceLedger();
  ledger.append({ eventId: 'e1', actor: 'a', action: 'build', source: 's', derivedArtifact: 'b' });
  ledger.append({ eventId: 'e2', actor: 'a', action: 'build', source: 's', parents: ['b'], derivedArtifact: 'c' });
  ledger.append({ eventId: 'e3', actor: 'a', action: 'build', source: 's', parents: ['c'], derivedArtifact: 'd' });
  assert.deepEqual(ledger.ancestors('d'), [{ id: 'c', depth: 1 }, { id: 'b', depth: 2 }]);
  assert.deepEqual(ledger.descendants('b'), [{ id: 'c', depth: 1 }, { id: 'd', depth: 2 }]);
  assert.deepEqual(ledger.descendants('b', { maxDepth: 1 }), [{ id: 'c', depth: 1 }]);
  assert.throws(() => ledger.ancestors('d', { maxDepth: 99999 }), error => error.code === 'INVALID_LIMIT');
});

test('serialization is deterministic and corruption fails closed', () => {
  const first = createProvenanceLedger();
  first.append({ eventId: 'e1', actor: 'a', action: 'build', source: 's', parents: ['src'], derivedArtifact: 'bin', metadata: { b: '2', a: '1' } });
  const serialized = first.serialize();
  const second = parseProvenanceSnapshot(serialized);
  assert.equal(second.serialize(), serialized);
  const envelope = JSON.parse(serialized);
  envelope.payload = envelope.payload.replace('bin', 'tampered');
  assert.throws(() => parseProvenanceSnapshot(JSON.stringify(envelope)), error => error.code === 'INTEGRITY_MISMATCH');
});

test('bounds and recovery are deterministic', () => {
  const ledger = createProvenanceLedger({ maxEvents: 1 });
  ledger.append({ eventId: 'e1', actor: 'a', action: 'build', source: 's', derivedArtifact: 'b' });
  assert.throws(() => ledger.append({ eventId: 'e2', actor: 'a', action: 'build', source: 's', derivedArtifact: 'c' }), error => error.code === 'INVALID_LIMIT');
  assert.equal(ledger.stats().events, 1);
});
