import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ArtifactLifecycleIndex, ArtifactLifecycleError, evaluateRetention } from '../src/index.js';

const record = (id, overrides = {}) => ({ id, state: overrides.state ?? 'live', createdAt: overrides.createdAt ?? 1000, updatedAt: overrides.updatedAt ?? 1000, expiresAt: overrides.expiresAt, tags: overrides.tags ?? ['stable'], references: overrides.references ?? ['cas:one'], metadata: overrides.metadata ?? { z: 2, a: 1 } });

test('lifecycle transitions are explicit and invalid transitions do not mutate state', async () => {
  const index = await new ArtifactLifecycleIndex().open();
  await index.add(record('a'));
  await index.transition('a', 'retained', 2000);
  assert.equal(index.get('a').state, 'retained');
  await assert.rejects(() => index.transition('a', 'deleted', 3000), (error) => error instanceof ArtifactLifecycleError && error.code === 'INVALID_TRANSITION');
  assert.equal(index.get('a').state, 'retained');
  await index.transition('a', 'expired', 4000);
  await index.transition('a', 'tombstoned', 5000);
  await index.transition('a', 'deleted', 6000);
  assert.equal(index.get('a').state, 'deleted');
  await assert.rejects(() => index.transition('a', 'live', 7000), /INVALID_TRANSITION|not allowed/);
});

test('retention evaluation is pure and deterministic', () => {
  const live = record('live', { createdAt: 0, updatedAt: 0, tags: ['hot'] });
  assert.deepEqual(evaluateRetention(live, { retainAfterMs: 1000 }, 1000), { action: 'transition', target: 'retained', reason: 'age_retained', age: 1000 });
  assert.deepEqual(evaluateRetention(live, { expireAfterMs: 2000 }, 2000), { action: 'transition', target: 'expired', reason: 'age_expired', age: 2000 });
  assert.deepEqual(evaluateRetention(live, { requiredTag: 'cold', expireAfterMs: 1 }, 9999), { action: 'none', reason: 'tag_not_selected', age: 9999 });
  assert.equal(live.state, 'live');
});

test('dry-run retention and purge plans are bounded and non-destructive', async () => {
  const index = await new ArtifactLifecycleIndex().open();
  await index.add(record('a', { updatedAt: 100 }));
  await index.add(record('b', { state: 'expired', updatedAt: 200 }));
  await index.add(record('c', { state: 'tombstoned', updatedAt: 300 }));
  assert.deepEqual(index.purgePlan({ olderThan: 250 }).map((item) => item.id), ['b']);
  assert.deepEqual(index.retentionPlan({ expireAfterMs: 50 }, 2000).map((item) => item.id), ['a']);
  assert.equal(index.get('b').state, 'expired');
  assert.equal(index.get('c').state, 'tombstoned');
});

test('query supports state/tag/age filters deterministically', async () => {
  const index = await new ArtifactLifecycleIndex().open();
  await index.add(record('b', { state: 'retained', tags: ['stable'] }));
  await index.add(record('a', { state: 'expired', tags: ['prod'], updatedAt: 50 }));
  assert.deepEqual(index.query({ state: 'expired' }).map((r) => r.id), ['a']);
  assert.deepEqual(index.query({ tag: 'stable' }).map((r) => r.id), ['b']);
  assert.deepEqual(index.query({ olderThan: 100 }).map((r) => r.id), ['a']);
});

test('persistence is deterministic and corruption fails closed', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'lifecycle-')); const file = path.join(root, 'state.sal');
  const index = await new ArtifactLifecycleIndex({ file }).open();
  await index.add(record('b')); await index.add(record('a'));
  const before = index.serialize();
  const restored = await new ArtifactLifecycleIndex({ file }).open();
  assert.deepEqual([...restored.serialize()], [...before]);
  await writeFile(file, Buffer.from('SAL1\n{"broken":true}\n'));
  await assert.rejects(() => new ArtifactLifecycleIndex({ file }).open(), (error) => error instanceof ArtifactLifecycleError && ['INVALID_STATE', 'CORRUPT_STATE'].includes(error.code));
});

test('accessors, duplicates, invalid times, bounds and recovery fail closed', async () => {
  const index = await new ArtifactLifecycleIndex({ limits: { maxRecords: 1 } }).open();
  const accessor = record('x'); Object.defineProperty(accessor, 'metadata', { enumerable: true, get() { throw new Error('getter'); } });
  await assert.rejects(() => index.add(accessor), /accessor/i);
  await index.add(record('a'));
  await assert.rejects(() => index.add(record('a')), /duplicate/i);
  await assert.rejects(() => index.transition('a', 'retained', 999), /precede|INVALID_TIME/);
  assert.equal(index.get('a').state, 'live');
  await assert.rejects(() => index.add(record('b')), /record count/i);
});
