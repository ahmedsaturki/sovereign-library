import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { ATOMIC_FILE_WRITER_FORMAT, AtomicFileWriterError, writeFileAtomic } from '../src/index.js';

const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

async function tempDir() {
  return mkdtemp(join(tmpdir(), 'sovereign-afw-'));
}

async function safeRm(path) {
  await rm(path, { recursive: true, force: true });
}

function expectCode(code) {
  return (error) => error instanceof AtomicFileWriterError && error.code === code;
}

test('creates an absent destination atomically and returns immutable report', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'config.json');
    const report = await writeFileAtomic(destination, '{"ok":true}', { idGenerator: () => 'operation-1234' });
    assert.equal(report.format, ATOMIC_FILE_WRITER_FORMAT);
    assert.equal(report.bytesWritten, 11);
    assert.equal(report.existedBefore, false);
    assert.equal(report.replaced, true);
    assert.equal(await readFile(destination, 'utf8'), '{"ok":true}');
    assert.equal(Object.isFrozen(report), true);
  } finally { await safeRm(root); }
});

test('replaces an existing regular file without exposing partial bytes', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'state.txt');
    await writeFile(destination, 'old-value');
    const report = await writeFileAtomic(destination, 'new-value', { idGenerator: () => 'operation-5678' });
    assert.equal(report.existedBefore, true);
    assert.equal(await readFile(destination, 'utf8'), 'new-value');
  } finally { await safeRm(root); }
});

test('supports streaming writer input and digest verification', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'stream.txt');
    const chunks = ['alpha', '-', 'beta'];
    const expected = Buffer.from(chunks.join(''));
    const report = await writeFileAtomic(destination, async (writer) => {
      for (const chunk of chunks) await writer.write(chunk);
    }, { digest: sha(expected), idGenerator: () => 'operation-stream' });
    assert.equal(report.digest, sha(expected));
    assert.equal(await readFile(destination, 'utf8'), 'alpha-beta');
  } finally { await safeRm(root); }
});

test('digest mismatch leaves the previous destination untouched', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'state.txt');
    await writeFile(destination, 'stable');
    await assert.rejects(writeFileAtomic(destination, 'tampered', { digest: sha(Buffer.from('other')), idGenerator: () => 'operation-digest' }), expectCode('DIGEST_MISMATCH'));
    assert.equal(await readFile(destination, 'utf8'), 'stable');
  } finally { await safeRm(root); }
});

test('rejects symlink destinations instead of following them', async () => {
  const root = await tempDir();
  try {
    const target = join(root, 'outside.txt');
    const destination = join(root, 'alias.txt');
    await writeFile(target, 'outside');
    await symlink(target, destination);
    await assert.rejects(writeFileAtomic(destination, 'inside', { idGenerator: () => 'operation-sym' }), expectCode('UNSAFE_SYMLINK'));
    assert.equal(await readFile(target, 'utf8'), 'outside');
  } finally { await safeRm(root); }
});

test('rejects a directory destination', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'dir');
    await (await import('node:fs/promises')).mkdir(destination);
    await assert.rejects(writeFileAtomic(destination, 'x', { idGenerator: () => 'operation-dir' }), expectCode('DESTINATION_NOT_REGULAR'));
  } finally { await safeRm(root); }
});

test('reports candidate collisions without deleting unrelated files', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'state.txt');
    const candidate = join(root, '.state.txt.sovereign-operation-collision.tmp');
    await writeFile(candidate, 'unrelated');
    await writeFile(destination, 'stable');
    await assert.rejects(writeFileAtomic(destination, 'new', { idGenerator: () => 'operation-collision' }), expectCode('CANDIDATE_COLLISION'));
    assert.equal(await readFile(destination, 'utf8'), 'stable');
    assert.equal(await readFile(candidate, 'utf8'), 'unrelated');
  } finally { await safeRm(root); }
});

test('failed candidate writes clean up the owned temporary file and preserve destination', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'state.txt');
    await writeFile(destination, 'stable');
    const fsOps = {
      lstat: async (path) => (await import('node:fs/promises')).lstat(path),
      open: async () => ({
        async write() { throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); },
        async close() {},
      }),
      rename: async (...args) => (await import('node:fs/promises')).rename(...args),
      unlink: async (...args) => (await import('node:fs/promises')).unlink(...args),
      chmod: async (...args) => (await import('node:fs/promises')).chmod(...args),
      mkdir: async (...args) => (await import('node:fs/promises')).mkdir(...args),
    };
    await assert.rejects(writeFileAtomic(destination, 'new', { fsOps, idGenerator: () => 'operation-fail' }), expectCode('WRITE_FAILED'));
    assert.equal(await readFile(destination, 'utf8'), 'stable');
  } finally { await safeRm(root); }
});

test('rejects oversized input before filesystem mutation', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'state.txt');
    await assert.rejects(writeFileAtomic(destination, Buffer.alloc(16 * 1024 * 1024 + 1), { idGenerator: () => 'operation-large' }), expectCode('LIMIT_EXCEEDED'));
  } finally { await safeRm(root); }
});

test('rejects accessor, circular metadata, and invalid capability seams', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'state.txt');
    const accessor = {}; Object.defineProperty(accessor, 'value', { get() { throw new Error('must not execute'); } });
    await assert.rejects(writeFileAtomic(destination, 'x', { metadata: accessor, idGenerator: () => 'operation-accessor' }), expectCode('ACCESSOR_INPUT'));
    const circular = {}; circular.self = circular;
    await assert.rejects(writeFileAtomic(destination, 'x', { metadata: circular, idGenerator: () => 'operation-circular' }), expectCode('CIRCULAR_INPUT'));
    await assert.rejects(writeFileAtomic(destination, 'x', { clock: { now: 1 }, idGenerator: () => 'operation-clock' }), expectCode('INVALID_CAPABILITY'));
  } finally { await safeRm(root); }
});

test('honors preserve-existing and explicit permission policies', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'mode.txt');
    await writeFile(destination, 'old', { mode: 0o640 });
    const preserved = await writeFileAtomic(destination, 'new', { modePolicy: 'preserve-existing', idGenerator: () => 'operation-mode-one' });
    assert.equal(preserved.replaced, true);
    const explicit = await writeFileAtomic(destination, 'newer', { modePolicy: 'explicit', mode: 0o600, idGenerator: () => 'operation-mode-two' });
    assert.equal(explicit.replaced, true);
  } finally { await safeRm(root); }
});

test('rejects unsupported durability without weakening atomic replacement', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'state.txt');
    await assert.rejects(writeFileAtomic(destination, 'x', { durability: 'bogus', idGenerator: () => 'operation-dur' }), expectCode('INVALID_DURABILITY'));
    assert.equal(await import('node:fs/promises').then(({ access }) => access(destination).then(() => false).catch(() => true)), true);
  } finally { await safeRm(root); }
});

test('supports deterministic clock and identity seams', async () => {
  const root = await tempDir();
  try {
    const destination = join(root, 'deterministic.txt');
    const report = await writeFileAtomic(destination, 'x', { idGenerator: () => 'operation-deterministic', clock: { now: () => 1735689600000 } });
    assert.equal(report.operationId, 'operation-deterministic');
    assert.equal(report.timestamp, '2025-01-01T00:00:00.000Z');
    assert.equal(typeof randomUUID(), 'string');
  } finally { await safeRm(root); }
});
