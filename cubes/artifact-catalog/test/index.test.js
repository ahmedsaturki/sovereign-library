import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ArtifactCatalog, ArtifactCatalogError, serializeState } from '../src/index.js';

const record = (identifier, overrides = {}) => ({
  identifier,
  packageName: overrides.packageName ?? 'demo',
  version: overrides.version ?? '1.0.0',
  digest: overrides.digest ?? 'a'.repeat(64),
  tags: overrides.tags ?? ['stable'],
  metadata: overrides.metadata ?? { z: 2, a: 1 },
});

test('add/update/remove and snapshots are deterministic', async () => {
  const catalog = await new ArtifactCatalog().open();
  await catalog.add(record('pkg:b'));
  await catalog.add(record('pkg:a', { version: '2.0.0' }));
  assert.deepEqual(catalog.query().map((item) => item.identifier), ['pkg:a', 'pkg:b']);
  const snapshot = catalog.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  await catalog.update(record('pkg:a', { version: '3.0.0' }));
  assert.equal(catalog.get('pkg:a').version, '3.0.0');
  assert.equal(await catalog.remove('pkg:b'), true);
  assert.equal(await catalog.remove('pkg:b'), false);
});

test('queries support exact, prefix, package, version, and tag filters deterministically', async () => {
  const catalog = await new ArtifactCatalog().open();
  await catalog.add(record('acme:a', { packageName: 'acme', version: '1.0.0', tags: ['stable', 'prod'] }));
  await catalog.add(record('acme:b', { packageName: 'acme', version: '2.0.0', tags: ['beta'] }));
  await catalog.add(record('other:a', { packageName: 'other', version: '1.0.0', tags: ['prod'] }));
  assert.equal(catalog.query({ identifier: 'acme:a' }).length, 1);
  assert.equal(catalog.query({ prefix: 'acme:' }).length, 2);
  assert.equal(catalog.query({ packageName: 'acme', version: '2.0.0' })[0].identifier, 'acme:b');
  assert.equal(catalog.query({ tag: 'prod' }).length, 2);
});

test('persistence round-trip is deterministic and corruption fails closed', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'catalog-'));
  const file = path.join(root, 'catalog.sac');
  const catalog = await new ArtifactCatalog({ file }).open();
  await catalog.add(record('a'));
  await catalog.add(record('b', { metadata: { b: 2, a: 1 } }));
  const before = catalog.serialize();
  const restored = await new ArtifactCatalog({ file }).open();
  assert.deepEqual([...restored.serialize()], [...before]);
  await writeFile(file, Buffer.from('SAC1\n{"broken":true}\n'));
  await assert.rejects(() => new ArtifactCatalog({ file }).open(), (error) => error instanceof ArtifactCatalogError && ['INVALID_CATALOG', 'CORRUPT_CATALOG'].includes(error.code));
});

test('accessors, duplicates, invalid digests and failed updates recover without poisoning valid state', async () => {
  const catalog = await new ArtifactCatalog().open();
  const accessor = record('x');
  Object.defineProperty(accessor, 'metadata', { enumerable: true, get() { throw new Error('getter'); } });
  await assert.rejects(() => catalog.add(accessor), /accessor/i);
  await assert.rejects(() => catalog.add(record('a', { digest: 'Z'.repeat(64) })), /digest/);
  await catalog.add(record('a'));
  await assert.rejects(() => catalog.add(record('a')), /duplicate/);
  assert.equal(catalog.get('a').identifier, 'a');
  await assert.rejects(() => catalog.update(record('missing')), /not found/);
  assert.equal(catalog.query({ prefix: 'a' }).length, 1);
});

test('bounds and result limits fail closed while valid calls recover', async () => {
  const catalog = await new ArtifactCatalog({ limits: { maxResults: 1, maxRecords: 2 } }).open();
  await catalog.add(record('a'));
  await catalog.add(record('b'));
  assert.equal(catalog.query().length, 1);
  await assert.rejects(() => catalog.add(record('c')), /record count/i);
  assert.equal(catalog.get('a').identifier, 'a');
});

test('standalone serialized state is reproducible independent of insertion order', async () => {
  const a = [record('b'), record('a')];
  const b = [record('a'), record('b')];
  const bytesA = serializeState(a, { maxRecords: 10, maxIdentifierBytes: 256, maxPackageBytes: 512, maxVersionBytes: 256, maxTagBytes: 256, maxMetadataBytes: 16000, maxResults: 10, maxSerializedBytes: 100000 });
  const bytesB = serializeState(b, { maxRecords: 10, maxIdentifierBytes: 256, maxPackageBytes: 512, maxVersionBytes: 256, maxTagBytes: 256, maxMetadataBytes: 16000, maxResults: 10, maxSerializedBytes: 100000 });
  assert.deepEqual([...bytesA], [...bytesB]);
});
