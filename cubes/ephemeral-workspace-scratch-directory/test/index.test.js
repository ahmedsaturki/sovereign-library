import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, symlink, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWorkspace, recoverWorkspace, parseWorkspaceRecord, serializeWorkspaceRecord, WorkspaceError, EPHEMERAL_WORKSPACE_FORMAT } from '../src/index.js';

async function root() { return mkdtemp(join(tmpdir(), 'ewc-')); }
function clock(start = 1_700_000_000_000) { let now = start; return { now: () => now, advance: (ms) => { now += ms; } }; }
function ids(...values) { let i = 0; return () => values[i++ % values.length]; }
async function cleanup(path) { await rm(path, { recursive: true, force: true }); }

test('creates unique workspace, exposes immutable identity, and cleans up', async () => {
  const parent = await root();
  try {
    const workspace = await createWorkspace({ parent, owner: { job: 'build', n: 1 }, idGenerator: ids('workspace-01', 'token-01') });
    assert.equal(workspace.state, 'active');
    assert.equal(Object.isFrozen(workspace), true);
    const path = await workspace.path();
    assert.ok(path.startsWith(parent));
    assert.equal((await workspace.cleanup()).state, 'cleaned');
    assert.equal((await workspace.cleanup()).state, 'cleaned');
    await assert.rejects(() => workspace.path(), (error) => error.code === 'WORKSPACE_ALREADY_CLEANED');
  } finally { await cleanup(parent); }
});

test('concurrent workspace creation is unique', async () => {
  const parent = await root();
  try {
    let calls = 0;
    const makeId = () => `workspace-${++calls}`;
    const [a, b] = await Promise.all([createWorkspace({ parent, idGenerator: makeId }), createWorkspace({ parent, idGenerator: makeId })]);
    assert.notEqual(a.workspaceId, b.workspaceId);
    await Promise.all([a.cleanup(), b.cleanup()]);
  } finally { await cleanup(parent); }
});

test('nested content cleanup remains confined to workspace subtree', async () => {
  const parent = await root();
  try {
    const workspace = await createWorkspace({ parent, idGenerator: ids('workspace-02', 'token-02') });
    const path = await workspace.path();
    await mkdir(join(path, 'nested', 'deep'), { recursive: true });
    await writeFile(join(path, 'nested', 'deep', 'payload.txt'), 'hello');
    await writeFile(join(parent, 'outside.txt'), 'keep');
    await workspace.cleanup();
    assert.equal(await readFile(join(parent, 'outside.txt'), 'utf8'), 'keep');
  } finally { await cleanup(parent); }
});

test('symlink replacement fails closed and cannot redirect cleanup', async () => {
  const parent = await root();
  const external = await root();
  try {
    const workspace = await createWorkspace({ parent, idGenerator: ids('workspace-03', 'token-03') });
    const path = await workspace.path();
    await writeFile(join(external, 'secret.txt'), 'do-not-delete');
    await rm(path, { recursive: true, force: true });
    await symlink(external, path);
    await assert.rejects(() => workspace.cleanup(), (error) => error.code === 'OWNERSHIP_MISMATCH');
    assert.equal(await readFile(join(external, 'secret.txt'), 'utf8'), 'do-not-delete');
  } finally { await cleanup(parent); await cleanup(external); }
});

test('ttl is deterministic and never auto-cleans by itself', async () => {
  const parent = await root();
  const c = clock();
  try {
    const workspace = await createWorkspace({ parent, ttlMs: 100, clock: c, idGenerator: ids('workspace-04', 'token-04') });
    assert.equal(workspace.isExpired(), false);
    c.advance(101);
    assert.equal(workspace.isExpired(), true);
    assert.ok(await workspace.path());
    await workspace.cleanup();
  } finally { await cleanup(parent); }
});

test('conservative recovery requires explicit recovery authority and expiry', async () => {
  const parent = await root();
  const c = clock();
  try {
    const workspace = await createWorkspace({ parent, ttlMs: 100, clock: c, idGenerator: ids('workspace-05', 'token-05') });
    await assert.rejects(() => recoverWorkspace({ parent, workspaceId: workspace.workspaceId, recoveryToken: 'wrong-token', clock: c }), (error) => error.code === 'OWNERSHIP_MISMATCH');
    await assert.rejects(() => recoverWorkspace({ parent, workspaceId: workspace.workspaceId, recoveryToken: workspace.record?.recoveryToken ?? 'missing', clock: c }), (error) => error.code === 'STALE_RECOVERY_REJECTED' || error.code === 'OWNERSHIP_MISMATCH');
    const record = parseWorkspaceRecord(await readFile(join(await workspace.path(), '.workspace.json'), 'utf8'));
    c.advance(101);
    const result = await recoverWorkspace({ parent, workspaceId: workspace.workspaceId, recoveryToken: record.recoveryToken, clock: c });
    assert.equal(result.state, 'recovered');
  } finally { await cleanup(parent); }
});

test('record integrity rejects tampering', () => {
  const record = { format: EPHEMERAL_WORKSPACE_FORMAT, workspaceId: 'workspace-06', workspacePath: '/tmp/workspace-06', parentPath: '/tmp', createdAt: '2026-01-01T00:00:00.000Z', expiresAt: null, owner: { a: 1 }, recoveryToken: 'token-06' };
  const serialized = serializeWorkspaceRecord(record);
  assert.deepEqual(parseWorkspaceRecord(serialized).owner, { a: 1 });
  const tampered = serialized.replace('workspace-06', 'workspace-07');
  assert.throws(() => parseWorkspaceRecord(tampered), (error) => error.code === 'INTEGRITY_MISMATCH');
});

test('accessors, circular values, oversized metadata, and invalid capabilities fail before mutation', async () => {
  const parent = await root();
  try {
    const accessor = { parent }; Object.defineProperty(accessor, 'owner', { get() { throw new Error('getter'); } });
    await assert.rejects(() => createWorkspace(accessor), (error) => error.code === 'ACCESSOR_INPUT');
    const circular = { parent, owner: {} }; circular.owner.loop = circular;
    await assert.rejects(() => createWorkspace(circular), (error) => error.code === 'CIRCULAR_INPUT');
    await assert.rejects(() => createWorkspace({ parent, owner: { blob: 'x'.repeat(5000) } }), (error) => error.code === 'LIMIT_EXCEEDED');
    await assert.rejects(() => createWorkspace({ parent, clock: { now: 1 } }), (error) => error.code === 'INVALID_CAPABILITY');
    assert.equal((await import('../src/index.js')).WorkspaceError.prototype instanceof Error, true);
  } finally { await cleanup(parent); }
});

test('failed independent creation does not poison later workspace creation', async () => {
  const parent = await root();
  try {
    const badFs = { mkdir: async () => { const error = new Error('denied'); error.code = 'EACCES'; throw error; }, readFile, writeFile, rm, lstat: async () => ({ isDirectory: () => true, isSymbolicLink: () => false }) };
    await assert.rejects(() => createWorkspace({ parent, fsOps: badFs, idGenerator: ids('workspace-07') }), (error) => error.code === 'PERMISSION_DENIED');
    const good = await createWorkspace({ parent, idGenerator: ids('workspace-08', 'token-08') });
    await good.cleanup();
  } finally { await cleanup(parent); }
});
