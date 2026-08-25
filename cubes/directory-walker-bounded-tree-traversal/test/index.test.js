import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { walk, DirectoryWalkerError } from '../src/index.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'sovereign-walker-'));
  await mkdir(join(root, 'b', 'deep'), { recursive: true });
  await mkdir(join(root, 'a'), { recursive: true });
  await writeFile(join(root, 'b', 'z.txt'), 'z');
  await writeFile(join(root, 'b', 'deep', 'y.txt'), 'y');
  await writeFile(join(root, 'a', 'x.txt'), 'x');
  return root;
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof DirectoryWalkerError && error.code === code);
}

async function expectRejectCode(fn, code) {
  await assert.rejects(fn, (error) => error instanceof DirectoryWalkerError && error.code === code);
}

test('deterministic collected traversal is sorted by relative path', async () => {
  const root = await fixture();
  try {
    const result = await walk(root);
    assert.deepEqual(result.map((x) => x.path), ['a', 'a/x.txt', 'b', 'b/deep', 'b/deep/y.txt', 'b/z.txt']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('visitor mode does not accumulate a result array', async () => {
  const root = await fixture(); const seen = [];
  try {
    const result = await walk(root, { mode: 'visitor', onEntry: async (entry) => { seen.push(entry.path); } });
    assert.equal(result.mode, 'visitor'); assert.equal(result.entries, seen.length); assert.equal(Array.isArray(result), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('accessor-backed options fail without getter execution', async () => {
  const root = await fixture(); let invoked = false; const options = {};
  Object.defineProperty(options, 'maxDepth', { get() { invoked = true; throw new Error('getter'); } });
  try { await expectRejectCode(() => walk(root, options), 'ACCESSOR_INPUT'); assert.equal(invoked, false); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('onEntry and signal remain executable seams rather than plain data', async () => {
  const root = await fixture(); const controller = new AbortController(); const seen = [];
  try {
    const result = await walk(root, { mode: 'visitor', onEntry: async (entry) => seen.push(entry.path), signal: controller.signal });
    assert.equal(result.entries, seen.length);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('maxDepth is enforced', async () => {
  const root = await fixture();
  try { await expectRejectCode(() => walk(root, { maxDepth: 1 }), 'DEPTH_LIMIT_EXCEEDED'); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('maxEntries is enforced before unbounded collection', async () => {
  const root = await fixture();
  try { await expectRejectCode(() => walk(root, { maxEntries: 2 }), 'ENTRY_LIMIT_EXCEEDED'); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('directory entry budget is enforced', async () => {
  const root = await fixture();
  try { await expectRejectCode(() => walk(root, { maxDirectoryEntries: 1 }), 'DIRECTORY_ENTRY_LIMIT_EXCEEDED'); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('work budget is enforced', async () => {
  const root = await fixture();
  try { await expectRejectCode(() => walk(root, { maxWorkUnits: 2 }), 'WORK_BUDGET_EXCEEDED'); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('abort signal stops traversal', async () => {
  const root = await fixture(); const controller = new AbortController(); controller.abort();
  try { await expectRejectCode(() => walk(root, { signal: controller.signal }), 'ABORTED'); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('deadline is enforced deterministically with injected clock', async () => {
  const root = await fixture(); let t = 0;
  const capabilities = {
    readDirectory: async (path) => (await import('node:fs/promises')).readdir(path, { withFileTypes: true }),
    lstat: async (path) => (await import('node:fs/promises')).lstat(path),
    realpath: async (path) => (await import('node:fs/promises')).realpath(path),
    now: () => { t += 100; return t; },
  };
  try { await expectRejectCode(() => walk(root, { deadlineMs: 50 }, capabilities), 'DEADLINE_EXCEEDED'); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('symlinks are reported without following by default', async () => {
  const root = await fixture();
  try {
    await symlink(join(root, 'a'), join(root, 'link-a'), 'junction').catch(async () => symlink(join(root, 'a'), join(root, 'link-a')));
    const result = await walk(root);
    assert.equal(result.find((x) => x.path === 'link-a').type, 'symlink');
    assert.equal(result.some((x) => x.path === 'link-a/x.txt'), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('reject symlink policy fails closed', async () => {
  const root = await fixture();
  try { await symlink(join(root, 'a'), join(root, 'link-a')).catch(() => {}); await expectRejectCode(() => walk(root, { symlinkPolicy: 'reject' }), 'SPECIAL_ENTRY_REJECTED'); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('follow-contained rejects root escapes', async () => {
  const root = await fixture(); const outside = await mkdtemp(join(tmpdir(), 'sovereign-outside-'));
  try {
    await symlink(outside, join(root, 'escape'));
    await expectRejectCode(() => walk(root, { symlinkPolicy: 'follow-contained' }), 'ROOT_ESCAPE');
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});

test('follow-contained rejects symlink cycles', async () => {
  const root = await fixture();
  try {
    await symlink(root, join(root, 'loop'));
    await expectRejectCode(() => walk(root, { symlinkPolicy: 'follow-contained' }), 'SYMLINK_CYCLE');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('partial return mode preserves bounded partial results', async () => {
  const root = await fixture();
  try {
    const result = await walk(root, { maxEntries: 2, partial: 'return' });
    assert.equal(result.partial, true); assert.equal(result.result.length, 2); assert.equal(result.error.code, 'ENTRY_LIMIT_EXCEEDED');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('malformed capability containers are rejected without recursion into hooks', async () => {
  const root = await fixture();
  try {
    const caps = { readDirectory: async () => [], lstat: async () => ({}) };
    Object.defineProperty(caps, 'realpath', { get() { throw new Error('getter'); } });
    await expectRejectCode(() => walk(root, { symlinkPolicy: 'follow-contained' }, caps), 'ACCESSOR_INPUT');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('filesystem remains unchanged', async () => {
  const root = await fixture();
  try {
    const before = await walk(root); await walk(root); const after = await walk(root); assert.deepEqual(after, before);
  } finally { await rm(root, { recursive: true, force: true }); }
});
