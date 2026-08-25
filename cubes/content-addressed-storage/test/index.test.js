import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CasStore, digest } from '../src/index.js';

test('put/get/has/delete is deterministic and immutable', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'cas-'));
  const store = await new CasStore({ root }).open();
  const address = await store.put(new Uint8Array([1, 2, 3]), { kind: 'test' });
  assert.equal(address, digest(new Uint8Array([1, 2, 3])));
  assert.equal(await store.has(address), true);
  assert.deepEqual([...await store.get(address)], [1, 2, 3]);
  assert.deepEqual(await store.metadata(address), { kind: 'test' });
  assert.equal(await store.delete(address), true);
  assert.equal(await store.has(address), false);
});

test('invalid metadata accessors fail before getter evaluation and valid writes recover', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'cas-'));
  const store = await new CasStore({ root, limits: { maxObjectBytes: 2 } }).open();
  await assert.rejects(() => store.put('123'), /Object exceeds limit/);
  const touched = { invoked: false };
  Object.defineProperty(touched, 'kind', { enumerable: true, get() { touched.invoked = true; return 'x'; } });
  await assert.rejects(() => store.put('x', touched), /Accessor metadata/);
  assert.equal(touched.invoked, false);
  const good = await store.put('ok');
  assert.equal(await store.has(good), true);
});

test('corruption is detected on read', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'cas-'));
  const store = await new CasStore({ root }).open();
  const address = await store.put('stable');
  const file = path.join(root, address.slice(0, 2), address.slice(2, 4), address);
  await writeFile(file, Buffer.from('tampered'));
  await assert.rejects(() => store.get(address), /Object digest mismatch/);
});
