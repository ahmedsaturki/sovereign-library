import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  snapshotDirectory,
  serializeDirectorySnapshot,
  DIRECTORY_SNAPSHOT_FORMAT,
} from '../src/index.js';

async function tempRoot() { return mkdtemp(join(tmpdir(), 'dsm-test-')); }
async function cleanup(root) { await rm(root, { recursive: true, force: true }); }
async function sha(buffer, algorithm) { return createHash(algorithm).update(buffer).digest('hex'); }

const baseOptions = (overrides = {}) => ({
  clock: { now: () => 1756123200000 },
  ...overrides,
});

const digestCapability = {
  algorithm: 'sha256',
  hashBuffer: sha,
};

test('captures deterministic sorted files and directories without following symlinks', async () => {
  const root = await tempRoot();
  try {
    await mkdir(join(root, 'z'));
    await mkdir(join(root, 'a'));
    await writeFile(join(root, 'z', 'b.txt'), 'b');
    await writeFile(join(root, 'a', 'a.txt'), 'a');
    const one = await snapshotDirectory(root, baseOptions());
    const two = await snapshotDirectory(root, baseOptions());
    assert.equal(one.format, DIRECTORY_SNAPSHOT_FORMAT);
    assert.deepEqual(one.entries.map((entry) => entry.path), ['a', 'a/a.txt', 'z', 'z/b.txt']);
    assert.deepEqual(one.entries, two.entries);
    assert.equal(one.snapshotId, two.snapshotId);
    assert.deepEqual(one.warnings, []);
  } finally { await cleanup(root); }
});

test('uses canonical root identity for platform-resolved filesystem paths', async () => {
  const root = await tempRoot();
  try {
    const canonical = (await realpath(root)).replace(/^\\\\\?\\/, '');
    const snapshot = await snapshotDirectory(root, baseOptions());
    assert.equal(snapshot.root, resolve(canonical));
  } finally { await cleanup(root); }
});

test('accepts capability seams without traversing or freezing executable functions', async () => {
  const root = await tempRoot();
  try {
    const snapshot = await snapshotDirectory(root, baseOptions({
      clock: { now: () => 1756123200000 },
      fsOps: {
        lstat: async (path) => import('node:fs/promises').then((fs) => fs.lstat(path)),
        readdir: async (path) => import('node:fs/promises').then((fs) => fs.readdir(path)),
        readFile: async (path) => import('node:fs/promises').then((fs) => fs.readFile(path)),
        realpath: async (path) => import('node:fs/promises').then((fs) => fs.realpath(path)),
      },
      serialize: (value) => JSON.stringify(value),
    }));
    assert.equal(snapshot.entries.length, 0);
  } finally { await cleanup(root); }
});

test('supports optional deterministic SHA-256 content digests', async () => {
  const root = await tempRoot();
  try {
    await writeFile(join(root, 'hello.txt'), 'hello');
    const snap = await snapshotDirectory(root, baseOptions({ digest: digestCapability }));
    const file = snap.entries.find((entry) => entry.path === 'hello.txt');
    assert.equal(file.digest, `sha256:${createHash('sha256').update('hello').digest('hex')}`);
  } finally { await cleanup(root); }
});

test('records symlinks without target traversal by default', async (t) => {
  const root = await tempRoot();
  const target = await tempRoot();
  try {
    await writeFile(join(target, 'secret.txt'), 'secret');
    try { await symlink(target, join(root, 'outside-link'), 'junction'); }
    catch (error) { t.skip(`symlink creation unavailable: ${error.message}`); return; }
    const snap = await snapshotDirectory(root, baseOptions());
    assert.equal(snap.entries.some((entry) => entry.path === 'outside-link' && entry.type === 'symlink'), true);
    assert.equal(snap.entries.some((entry) => entry.path.endsWith('secret.txt')), false);
  } finally { await cleanup(root); await cleanup(target); }
});

test('rejects symlinks under reject policy', async (t) => {
  const root = await tempRoot();
  const target = await tempRoot();
  try {
    await writeFile(join(target, 'secret.txt'), 'secret');
    try { await symlink(target, join(root, 'link'), 'junction'); }
    catch (error) { t.skip(`symlink creation unavailable: ${error.message}`); return; }
    await assert.rejects(
      snapshotDirectory(root, baseOptions({ symlinkPolicy: 'reject' })),
      (error) => error.code === 'SYMLINK_POLICY',
    );
  } finally { await cleanup(root); await cleanup(target); }
});

test('allows contained symlink traversal and refuses escaping targets', async (t) => {
  const root = await tempRoot();
  const outside = await tempRoot();
  try {
    await mkdir(join(root, 'inside'));
    await writeFile(join(root, 'inside', 'value.txt'), 'ok');
    try {
      await symlink(join(root, 'inside'), join(root, 'inside-link'), 'junction');
      await symlink(outside, join(root, 'outside-link'), 'junction');
    } catch (error) { t.skip(`symlink creation unavailable: ${error.message}`); return; }
    await assert.rejects(
      snapshotDirectory(root, baseOptions({ symlinkPolicy: 'follow-contained' })),
      (error) => error.code === 'PATH_CONTAINMENT',
    );
  } finally { await cleanup(root); await cleanup(outside); }
});

test('detects contained symlink cycles without unbounded recursion', async (t) => {
  const root = await tempRoot();
  try {
    await mkdir(join(root, 'dir'));
    try { await symlink(root, join(root, 'dir', 'back'), 'junction'); }
    catch (error) { t.skip(`symlink creation unavailable: ${error.message}`); return; }
    const snap = await snapshotDirectory(root, baseOptions({ symlinkPolicy: 'follow-contained' }));
    const cycle = snap.entries.find((entry) => entry.path === 'dir/back');
    assert.equal(cycle.followed, false);
    assert.equal(cycle.cycle, true);
  } finally { await cleanup(root); }
});

test('enforces entry and depth limits', async () => {
  const root = await tempRoot();
  try {
    await mkdir(join(root, 'a'));
    await writeFile(join(root, 'a', 'b.txt'), 'b');
    await assert.rejects(snapshotDirectory(root, baseOptions({ maxEntries: 1 })), (error) => error.code === 'LIMIT_EXCEEDED');
    await assert.rejects(snapshotDirectory(root, baseOptions({ maxDepth: 0 })), (error) => error.code === 'LIMIT_EXCEEDED');
  } finally { await cleanup(root); }
});

test('handles vanished entries using the configured mutation policy', async () => {
  const root = await tempRoot();
  try {
    const realFs = await import('node:fs/promises');
    const fsOps = {
      async lstat(path) {
        if (path.endsWith('ghost.txt')) { const error = new Error('gone'); error.code = 'ENOENT'; throw error; }
        return realFs.lstat(path);
      },
      async readdir() { return ['ghost.txt']; },
      async readFile() { throw new Error('unused'); },
      async realpath(path) { return path; },
    };
    const snap = await snapshotDirectory(root, baseOptions({ fsOps, mutationPolicy: 'record-warning' }));
    assert.deepEqual(snap.entries, []);
    assert.equal(snap.warnings[0].code, 'VANISHED_ENTRY');
    await assert.rejects(snapshotDirectory(root, { ...baseOptions(), fsOps, mutationPolicy: 'fail-fast' }), (error) => error.code === 'VANISHED_ENTRY');
  } finally { await cleanup(root); }
});

test('produces canonical stable serialization and immutable output', async () => {
  const root = await tempRoot();
  try {
    await writeFile(join(root, 'x'), 'x');
    const snap = await snapshotDirectory(root, baseOptions());
    const serialized = serializeDirectorySnapshot(snap);
    assert.equal(typeof serialized, 'string');
    assert.equal(Object.isFrozen(snap), true);
    assert.equal(Object.isFrozen(snap.entries), true);
    assert.equal(serializeDirectorySnapshot(snap), serialized);
    assert.equal(snap.serialized.includes('"snapshotId"'), false);
  } finally { await cleanup(root); }
});

test('rejects accessor options before executing capability seams', async () => {
  const root = await tempRoot();
  try {
    const options = {};
    Object.defineProperty(options, 'clock', { get() { throw new Error('must not execute'); } });
    await assert.rejects(snapshotDirectory(root, options), (error) => error.code === 'ACCESSOR_INPUT');
  } finally { await cleanup(root); }
});

test('rejects circular manifest values at the data serialization boundary', () => {
  const circular = {};
  circular.self = circular;
  assert.throws(() => serializeDirectorySnapshot(circular), (error) => error.code === 'CIRCULAR_INPUT');
});

test('rejects invalid roots and manifest-size limits', async () => {
  await assert.rejects(snapshotDirectory('/definitely/missing/path', baseOptions()), (error) => error.code === 'INVALID_ROOT');
  const root = await tempRoot();
  try {
    for (let index = 0; index < 40; index += 1) await writeFile(join(root, `entry-${index.toString().padStart(2, '0')}.txt`), 'x'.repeat(64));
    await assert.rejects(snapshotDirectory(root, baseOptions({ maxManifestBytes: 1024 })), (error) => error.code === 'LIMIT_EXCEEDED');
  } finally { await cleanup(root); }
});

test('does not write into the scanned tree', async () => {
  const root = await tempRoot();
  try {
    await writeFile(join(root, 'keep.txt'), 'keep');
    await snapshotDirectory(root, baseOptions());
    assert.equal(await readFile(join(root, 'keep.txt'), 'utf8'), 'keep');
  } finally { await cleanup(root); }
});
