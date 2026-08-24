import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage, StorageCubeError } from '../src/index.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'sovereign-storage-'));
  return { root, store: await new Storage({ root, maxValueBytes: 4096 }).init() };
}

test('set/get/has/list/delete works', async () => {
  const { root, store } = await fixture();
  try {
    await store.set('users', 'a', { name: 'Ahmed', ok: true });
    assert.deepEqual(await store.get('users', 'a'), { name: 'Ahmed', ok: true });
    assert.equal(await store.has('users', 'a'), true);
    assert.deepEqual(await store.list('users'), ['a']);
    await store.delete('users', 'a');
    assert.equal(await store.get('users', 'a'), undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('ttl expires deterministically', async () => {
  const { root, store } = await fixture();
  try {
    await store.set('ttl', 'a', { value: 1 }, { ttlMs: 20 });
    assert.deepEqual(await store.get('ttl', 'a'), { value: 1 });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(await store.get('ttl', 'a'), undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('json-unsafe values and size limits are rejected', async () => {
  const { root, store } = await fixture();
  try {
    await assert.rejects(() => store.set('x', 'big', { value: 'x'.repeat(5000) }), e => e instanceof StorageCubeError && e.code === 'VALUE_TOO_LARGE');
    await assert.rejects(() => store.set('x', 'bigint', 1n), e => e instanceof StorageCubeError && e.code === 'INVALID_VALUE');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('unsafe namespace/key names are rejected', async () => {
  const { root, store } = await fixture();
  try {
    await assert.rejects(() => store.set('../x', 'a', 1), e => e instanceof StorageCubeError && e.code === 'INVALID_NAMESPACE');
    await assert.rejects(() => store.get('x', '../a'), e => e instanceof StorageCubeError && e.code === 'INVALID_KEY');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('corrupt records are detected', async () => {
  const { root, store } = await fixture();
  try {
    const file = await store.info('corrupt', 'a');
    assert.equal(file, undefined);
    await store.set('corrupt', 'a', { ok: true });
    const real = (await store.info('corrupt', 'a')).path;
    const { writeFile } = await import('node:fs/promises');
    await writeFile(real, '{bad', 'utf8');
    await assert.rejects(() => store.get('corrupt', 'a'), e => e instanceof StorageCubeError && e.code === 'CORRUPT_RECORD');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('ttl validation is deterministic', async () => {
  const { root, store } = await fixture();
  try {
    await assert.rejects(() => store.set('x', 'a', 1, { ttlMs: 0 }), e => e instanceof StorageCubeError && e.code === 'INVALID_TTL');
  } finally { await rm(root, { recursive: true, force: true }); }
});
