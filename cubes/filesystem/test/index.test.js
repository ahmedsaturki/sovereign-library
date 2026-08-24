import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  exists, stat, readText, writeText, appendText, atomicWriteText,
  list, mkdir, copy, move, remove, FilesystemCubeError, resolve
} from '../src/index.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sovereign-fs-'));
after(async () => { await fs.rm(root, { recursive: true, force: true }); });

const opts = { cwd: root, root: '.' };

test('write/read/append/stat/exists lifecycle works', async () => {
  await writeText('a/one.txt', 'hello', { ...opts, mkdir: true });
  assert.equal(await exists('a/one.txt', opts), true);
  await appendText('a/one.txt', ' world', opts);
  assert.equal(await readText('a/one.txt', opts), 'hello world');
  const info = await stat('a/one.txt', opts);
  assert.equal(info.isFile(), true);
  assert.equal(info.size, 11);
});

test('atomic write replaces content', async () => {
  await atomicWriteText('a/one.txt', 'atomic', opts);
  assert.equal(await readText('a/one.txt', opts), 'atomic');
});

test('list/copy/move/remove work', async () => {
  await mkdir('b', opts);
  const items = await list('.', opts);
  assert.equal(items.some(item => item.name === 'a' && item.type === 'directory'), true);
  await copy('a/one.txt', 'b/two.txt', { ...opts, mkdir: true });
  assert.equal(await readText('b/two.txt', opts), 'atomic');
  await move('b/two.txt', 'b/three.txt', opts);
  assert.equal(await exists('b/two.txt', opts), false);
  assert.equal(await exists('b/three.txt', opts), true);
  await remove('b', { ...opts, recursive: true });
  assert.equal(await exists('b', opts), false);
});

test('root containment blocks path traversal', async () => {
  assert.throws(() => resolve('../escape.txt', opts), error => error instanceof FilesystemCubeError && error.code === 'PATH_OUTSIDE_ROOT');
});

test('read and write limits are enforced', async () => {
  await assert.rejects(
    () => writeText('limit.txt', '123456', { ...opts, maxBytes: 5 }),
    error => error instanceof FilesystemCubeError && error.code === 'WRITE_TOO_LARGE'
  );
  await writeText('limit.txt', '123456', opts);
  await assert.rejects(
    () => readText('limit.txt', { ...opts, maxBytes: 5 }),
    error => error instanceof FilesystemCubeError && error.code === 'READ_TOO_LARGE'
  );
});

test('invalid and missing paths are deterministic errors', async () => {
  assert.throws(() => resolve('', opts), error => error.code === 'INVALID_PATH');
  await assert.rejects(() => readText('missing.txt', opts), error => error instanceof FilesystemCubeError && error.code === 'NOT_FOUND');
});

test('directories cannot be read as files', async () => {
  await mkdir('dir', opts);
  await assert.rejects(() => readText('dir', opts), error => error instanceof FilesystemCubeError && error.code === 'NOT_A_FILE');
});
