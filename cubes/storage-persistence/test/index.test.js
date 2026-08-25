import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSnapshotStore, SnapshotError } from '../src/index.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sovereign-snapshot-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('creates deterministic canonical snapshot bytes', () => {
  const store = createSnapshotStore();
  const a = store.create({ b: 2, a: 1, nested: { z: 'x', y: true } }, { owner: 'test', version: 1 });
  const b = store.create({ nested: { y: true, z: 'x' }, a: 1, b: 2 }, { version: 1, owner: 'test' });
  assert.equal(a.envelope, b.envelope);
  assert.equal(a.checksum, b.checksum);
  assert.ok(Object.isFrozen(a));
});

test('save and load round-trip without mutating source', async () => {
  await withTempDir(async dir => {
    const file = path.join(dir, 'snapshot.slib');
    const source = { z: [1, 2], a: { name: 'demo' } };
    const before = JSON.stringify(source);
    const store = createSnapshotStore();
    await store.save(file, source, { purpose: 'test' });
    const loaded = await store.load(file);
    assert.deepEqual(loaded.payload, source);
    assert.deepEqual(loaded.metadata, { purpose: 'test' });
    assert.equal(JSON.stringify(source), before);
    assert.ok(Object.isFrozen(loaded));
    assert.ok(Object.isFrozen(loaded.payload));
  });
});

test('negative zero and nested object key ordering are preserved canonically', () => {
  const store = createSnapshotStore();
  const snapshot = store.create({ value: -0, z: { b: 2, a: 1 } });
  assert.match(snapshot.envelope, /-0/);
  assert.equal(snapshot.checksum.length, 64);
});

test('checksum corruption fails closed', async () => {
  await withTempDir(async dir => {
    const file = path.join(dir, 'bad.slib');
    const store = createSnapshotStore();
    const snapshot = store.create({ safe: true });
    await writeFile(file, `${snapshot.envelope}x`);
    await assert.rejects(() => store.load(file), error => error instanceof SnapshotError && error.code === 'MALFORMED_SNAPSHOT');
  });
});

test('payload tampering produces an integrity failure', async () => {
  await withTempDir(async dir => {
    const file = path.join(dir, 'tampered.slib');
    const store = createSnapshotStore();
    const snapshot = store.create({ safe: 'value' });
    const tampered = snapshot.envelope.replace('"value"', '"changed"');
    await writeFile(file, tampered);
    await assert.rejects(() => store.load(file), error => error instanceof SnapshotError && error.code === 'INTEGRITY_FAILURE');
  });
});

test('truncated and future-version snapshots fail closed', async () => {
  await withTempDir(async dir => {
    const file = path.join(dir, 'broken.slib');
    const store = createSnapshotStore();
    await writeFile(file, 'SLIBSNAP\n1\nsha256\n{}\n');
    await assert.rejects(() => store.load(file), error => error instanceof SnapshotError && error.code === 'MALFORMED_SNAPSHOT');
    const base = store.create({ ok: true });
    await writeFile(file, base.envelope.replace('\n1\n', '\n2\n'));
    await assert.rejects(() => store.load(file), error => error instanceof SnapshotError && error.code === 'UNSUPPORTED_VERSION');
  });
});

test('oversized payloads are rejected before persistence', async () => {
  const store = createSnapshotStore({ limits: { maxPayloadBytes: 8 } });
  assert.throws(() => store.create({ value: 'this is too large' }), error => error instanceof SnapshotError && error.code === 'LIMIT_EXCEEDED');
});

test('circular values and accessor values fail without evaluating getters', () => {
  const store = createSnapshotStore();
  const circular = {};
  circular.self = circular;
  assert.throws(() => store.create(circular), error => error instanceof SnapshotError && error.code === 'UNSUPPORTED_VALUE');
  let evaluated = false;
  const accessor = {};
  Object.defineProperty(accessor, 'secret', { get() { evaluated = true; return 'x'; }, enumerable: true });
  assert.throws(() => store.create(accessor), error => error instanceof SnapshotError && error.code === 'UNSUPPORTED_VALUE');
  assert.equal(evaluated, false);
});

test('loaded snapshots are immutable and checksum is stable', async () => {
  await withTempDir(async dir => {
    const file = path.join(dir, 'immutable.slib');
    const store = createSnapshotStore({ algorithm: 'sha512' });
    await store.save(file, { nested: { count: 1 } });
    const loaded = await store.load(file);
    assert.equal(loaded.algorithm, 'sha512');
    assert.equal(loaded.checksum.length, 128);
    assert.throws(() => { loaded.payload.nested.count = 2; }, TypeError);
    assert.equal((await store.load(file)).payload.nested.count, 1);
  });
});

test('atomic replacement keeps the previous valid snapshot when a later save is rejected before commit', async () => {
  await withTempDir(async dir => {
    const file = path.join(dir, 'stable.slib');
    const store = createSnapshotStore({ limits: { maxPayloadBytes: 32 } });
    await store.save(file, { version: 1 });
    await assert.rejects(() => store.save(file, { version: 'this payload is rejected by the bound' }), error => error instanceof SnapshotError && error.code === 'LIMIT_EXCEEDED');
    const loaded = await store.load(file);
    assert.deepEqual(loaded.payload, { version: 1 });
  });
});

test('missing snapshots and invalid paths are typed errors', async () => {
  await withTempDir(async dir => {
    const store = createSnapshotStore();
    await assert.rejects(() => store.load(path.join(dir, 'missing.slib')), error => error instanceof SnapshotError && error.code === 'NOT_FOUND');
    assert.throws(() => store.create(undefined), error => error instanceof SnapshotError && error.code === 'UNSUPPORTED_VALUE');
    await assert.rejects(() => store.load(''), error => error instanceof SnapshotError && error.code === 'INVALID_PATH');
  });
});

test('malformed metadata and unsupported format fail before payload exposure', async () => {
  await withTempDir(async dir => {
    const file = path.join(dir, 'format.slib');
    const store = createSnapshotStore();
    const snapshot = store.create({ secret: 'payload' });
    const malformed = snapshot.envelope.replace('SLIBSNAP', 'OTHER');
    await writeFile(file, malformed);
    const error = await assert.rejects(() => store.load(file), SnapshotError);
    assert.notEqual(error?.message?.includes('payload'), true);
  });
});
