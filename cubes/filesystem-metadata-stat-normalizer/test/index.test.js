import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, lstat, mkdir, symlink, chmod, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  normalizeEntryMetadata,
  normalizeStat,
  serializeMetadata,
  parseMetadata,
  MetadataNormalizerError,
} from '../src/index.js';

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof MetadataNormalizerError && error.code === code);
}
async function expectRejectCode(fn, code) {
  await assert.rejects(fn, (error) => error instanceof MetadataNormalizerError && error.code === code);
}

function fakeStat(kind, overrides = {}) {
  const base = {
    size: 10,
    mode: 0o644,
    uid: 1000,
    gid: 1000,
    nlink: 1,
    ino: 42,
    dev: 7,
    blocks: 1,
    blksize: 512,
    birthtimeMs: 1_700_000_000_000,
    ctimeMs: 1_700_000_000_001,
    mtimeMs: 1_700_000_000_002,
    atimeMs: 1_700_000_000_003,
    isFile: () => kind === 'file',
    isDirectory: () => kind === 'directory',
    isSymbolicLink: () => kind === 'symlink',
    isSocket: () => kind === 'socket',
    isBlockDevice: () => kind === 'block-device',
    isCharacterDevice: () => kind === 'character-device',
    isFIFO: () => kind === 'fifo',
  };
  return { ...base, ...overrides };
}

function capsFrom(raw) {
  return {
    lstat: async () => raw,
    stat: async () => raw,
    readlink: async () => 'target.txt',
    containment: async () => true,
    now: () => 1000,
    hostPlatform: () => 'linux',
  };
}

test('native regular file metadata normalizes without mutation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sovereign-fmn-'));
  const file = join(root, 'file.txt');
  try {
    await writeFile(file, 'hello');
    const raw = await lstat(file);
    const out = await normalizeStat(file);
    assert.equal(out.kind, 'file');
    assert.equal(out.path, file);
    assert.equal(out.observedWith, 'lstat');
    assert.equal(out.size, raw.size);
    assert.equal(Object.isFrozen(out), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('normalizes each supported entry kind deterministically', () => {
  for (const kind of ['file', 'directory', 'symlink', 'socket', 'block-device', 'character-device', 'fifo']) {
    const out = normalizeEntryMetadata(fakeStat(kind), '/x', { _platform: 'linux' });
    assert.equal(out.kind, kind);
  }
});

test('unknown entry kind is represented explicitly', () => {
  const out = normalizeEntryMetadata(fakeStat('unknown'), '/x', { _platform: 'linux' });
  assert.equal(out.kind, 'unknown');
});

test('unsafe numeric fields fail closed', () => {
  expectCode(() => normalizeEntryMetadata(fakeStat('file', { size: Number.MAX_SAFE_INTEGER + 1 }), '/x', { _platform: 'linux' }), 'UNSAFE_NUMBER');
});

test('negative and non-finite timestamps fail closed', () => {
  expectCode(() => normalizeEntryMetadata(fakeStat('file', { mtimeMs: -1 }), '/x', { _platform: 'linux' }), 'INVALID_TIMESTAMP');
  expectCode(() => normalizeEntryMetadata(fakeStat('file', { ctimeMs: Infinity }), '/x', { _platform: 'linux' }), 'INVALID_TIMESTAMP');
});

test('unsupported numeric identity fields normalize to null without fabrication', () => {
  const out = normalizeEntryMetadata(fakeStat('file', { uid: -1, gid: -1, ino: Number.MAX_SAFE_INTEGER + 10 }), '/x', { _platform: 'windows' });
  assert.equal(out.uid, null);
  assert.equal(out.gid, null);
  assert.equal(out.inode, null);
});

test('mode and readonly semantics are deterministic', () => {
  assert.equal(normalizeEntryMetadata(fakeStat('file', { mode: 0o644 }), '/x', { _platform: 'linux' }).readonly, false);
  assert.equal(normalizeEntryMetadata(fakeStat('file', { mode: 0o444 }), '/x', { _platform: 'linux' }).readonly, true);
});

test('symlink default does not follow the target', async () => {
  const caps = capsFrom(fakeStat('symlink'));
  const out = await normalizeStat('/link', {}, caps);
  assert.equal(out.kind, 'symlink');
  assert.equal(out.observedWith, 'lstat');
  assert.equal(out.symlinkTarget, null);
});

test('symlink target reporting uses readlink without following', async () => {
  const caps = capsFrom(fakeStat('symlink'));
  const out = await normalizeStat('/link', { includeSymlinkTarget: true }, caps);
  assert.equal(out.symlinkTarget, 'target.txt');
  assert.equal(out.observedWith, 'lstat');
});

test('stat policy follows a symlink target', async () => {
  const caps = { ...capsFrom(fakeStat('symlink')), stat: async () => fakeStat('file', { size: 99 }) };
  const out = await normalizeStat('/link', { symlinkPolicy: 'stat', includeSymlinkTarget: true }, caps);
  assert.equal(out.kind, 'file');
  assert.equal(out.size, 99);
  assert.equal(out.observedWith, 'stat');
  assert.equal(out.symlinkTarget, 'target.txt');
});

test('contained policy rejects escaping symlink targets', async () => {
  const caps = { ...capsFrom(fakeStat('symlink')), containment: async () => false };
  await expectRejectCode(() => normalizeStat('/root/link', { symlinkPolicy: 'contained', root: '/root', includeSymlinkTarget: true }, caps), 'ROOT_ESCAPE');
});

test('contained policy requires explicit root and capabilities', async () => {
  const caps = capsFrom(fakeStat('symlink'));
  await expectRejectCode(() => normalizeStat('/link', { symlinkPolicy: 'contained' }, caps), 'INVALID_OPTIONS');
});

test('native errors map and recover by policy', async () => {
  const lstatCaps = { lstat: async () => { const e = new Error('nope'); e.code = 'ENOENT'; throw e; }, now: () => 1, hostPlatform: () => 'linux' };
  await expectRejectCode(() => normalizeStat('/missing', {}, lstatCaps), 'NOT_FOUND');
  assert.equal(await normalizeStat('/missing', { recovery: 'return-null' }, lstatCaps), null);
  const result = await normalizeStat('/missing', { recovery: 'return-error' }, lstatCaps);
  assert.equal(result.ok, false); assert.equal(result.error.code, 'NOT_FOUND');
});

test('permission failures recover independently', async () => {
  const caps = { lstat: async () => { const e = new Error('denied'); e.code = 'EACCES'; throw e; }, now: () => 1, hostPlatform: () => 'linux' };
  assert.equal(await normalizeStat('/x', { recovery: 'return-null' }, caps), null);
});

test('accessor options fail before getter evaluation', async () => {
  const caps = capsFrom(fakeStat('file')); let invoked = false;
  const options = {};
  Object.defineProperty(options, 'maxPathLength', { get() { invoked = true; throw new Error('getter'); } });
  await expectRejectCode(() => normalizeStat('/x', options, caps), 'ACCESSOR_INPUT');
  assert.equal(invoked, false);
});

test('capability accessors fail before getter execution', async () => {
  const caps = capsFrom(fakeStat('file')); let invoked = false;
  Object.defineProperty(caps, 'stat', { get() { invoked = true; throw new Error('getter'); } });
  await expectRejectCode(() => normalizeStat('/x', {}, caps), 'ACCESSOR_INPUT');
  assert.equal(invoked, false);
});

test('circular options fail closed', async () => {
  const options = {}; options.self = options;
  await expectRejectCode(() => normalizeStat('/x', options, capsFrom(fakeStat('file'))), 'INVALID_OPTIONS');
});

test('path and target bounds are enforced', async () => {
  await expectRejectCode(() => normalizeStat('/' + 'x'.repeat(100), { maxPathLength: 16 }, capsFrom(fakeStat('file'))), 'PATH_LIMIT_EXCEEDED');
  const caps = { ...capsFrom(fakeStat('symlink')), readlink: async () => 'x'.repeat(100) };
  await expectRejectCode(() => normalizeStat('/link', { includeSymlinkTarget: true, maxSymlinkTargetLength: 16 }, caps), 'LIMIT_EXCEEDED');
});

test('serialization is deterministic and integrity-protected', () => {
  const metadata = normalizeEntryMetadata(fakeStat('file'), '/x', { _platform: 'linux' });
  const a = serializeMetadata(metadata);
  const b = serializeMetadata({ ...metadata });
  assert.equal(a, b);
  const parsed = parseMetadata(a);
  assert.deepEqual(parsed, metadata);
  assert.equal(Object.isFrozen(parsed), true);
});

test('serialization tamper and malformed inputs fail closed', () => {
  const metadata = normalizeEntryMetadata(fakeStat('file'), '/x', { _platform: 'linux' });
  const wire = serializeMetadata(metadata);
  const tampered = wire.replace('"size":10', '"size":11');
  expectCode(() => parseMetadata(tampered), 'SERIALIZATION_FAILURE');
  expectCode(() => parseMetadata('{bad'), 'SERIALIZATION_FAILURE');
});

test('serialization is bounded and source metadata remains unchanged', () => {
  const metadata = normalizeEntryMetadata(fakeStat('file'), '/x', { _platform: 'linux' });
  const before = JSON.stringify(metadata);
  const wire = serializeMetadata(metadata);
  assert.equal(JSON.stringify(metadata), before);
  expectCode(() => serializeMetadata(metadata, { maxMetadataBytes: 16 }), 'LIMIT_EXCEEDED');
  assert.equal(typeof wire, 'string');
});

test('privacy boundary stays coarse and does not expose host/user fields', async () => {
  const caps = { ...capsFrom(fakeStat('file')), hostPlatform: () => 'linux' };
  const out = await normalizeStat('/x', {}, caps);
  assert.equal(out.platform, 'linux');
  assert.equal(Object.prototype.hasOwnProperty.call(out, 'hostname'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(out, 'username'), false);
});

test('valid calls recover after rejected normalization', async () => {
  const caps = capsFrom(fakeStat('file'));
  await expectRejectCode(() => normalizeStat('/' + 'x'.repeat(100), { maxPathLength: 4 }, caps), 'PATH_LIMIT_EXCEEDED');
  const valid = await normalizeStat('/x', {}, caps);
  assert.equal(valid.kind, 'file');
});

test('native directory metadata smoke works without mutation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sovereign-fmn-dir-'));
  const dir = join(root, 'd');
  try {
    await mkdir(dir);
    const out = await normalizeStat(dir);
    assert.equal(out.kind, 'directory');
    assert.equal(Object.isFrozen(out), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
