import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { acquireLease, parseLeaseRecord, serializeLeaseRecord, FileLeaseError, FILE_LEASE_FORMAT } from '../src/index.js';

async function tempRoot() { return mkdtemp(join(tmpdir(), 'flc-')); }
function clock(start = 1_700_000_000_000) { let now = start; return { now: () => now, advance: (ms) => { now += ms; } }; }
function uuidSequence(...ids) { let i = 0; return () => ids[i++ % ids.length]; }
async function cleanup(root) { await rm(root, { recursive: true, force: true }); }

test('acquires, renews, releases, and reacquires a local advisory lease', async () => {
  const root = await tempRoot();
  const c = clock();
  try {
    const first = await acquireLease({ resourcePath: join(root, 'resource.db'), lockPath: join(root, 'resource.lock'), ttlMs: 1000, clock: c, uuid: uuidSequence('lease-one') });
    assert.equal(first.state, 'acquired');
    assert.equal(first.lockPath.endsWith('resource.lock'), true);
    assert.equal(Object.isFrozen(first), true);
    c.advance(1);
    const renewed = await first.renew();
    assert.equal(renewed.state, 'acquired');
    assert.ok(renewed.expiresAt > first.expiresAt);
    const released = await first.release();
    assert.equal(released.state, 'released');
    assert.equal((await first.release()).state, 'released');
    const second = await acquireLease({ resourcePath: join(root, 'resource.db'), lockPath: join(root, 'resource.lock'), clock: c, uuid: uuidSequence('lease-two') });
    assert.equal(second.leaseId, 'lease-two');
    await second.release();
  } finally { await cleanup(root); }
});

test('two concurrent contenders cannot both acquire the same lock', async () => {
  const root = await tempRoot();
  try {
    const lockPath = join(root, 'shared.lock');
    const results = await Promise.allSettled([
      acquireLease({ resourcePath: join(root, 'resource'), lockPath, uuid: uuidSequence('race-one') }),
      acquireLease({ resourcePath: join(root, 'resource'), lockPath, uuid: uuidSequence('race-two') }),
    ]);
    const acquired = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    assert.equal(acquired.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason instanceof FileLeaseError, true);
    assert.equal(rejected[0].reason.code, 'LOCK_BUSY');
    await acquired[0].value.release();
  } finally { await cleanup(root); }
});

test('busy lock is not recovered by default', async () => {
  const root = await tempRoot();
  try {
    const lockPath = join(root, 'busy.lock');
    const first = await acquireLease({ resourcePath: join(root, 'resource'), lockPath, uuid: uuidSequence('holder-01') });
    await assert.rejects(() => acquireLease({ resourcePath: join(root, 'resource'), lockPath, uuid: uuidSequence('contender-01') }), (error) => error.code === 'LOCK_BUSY');
    await first.release();
  } finally { await cleanup(root); }
});

test('ttl expiration prevents renewal and enables conservative stale recovery', async () => {
  const root = await tempRoot();
  const c = clock();
  const lockPath = join(root, 'lease.lock');
  try {
    const first = await acquireLease({ resourcePath: join(root, 'resource'), lockPath, ttlMs: 100, clock: c, uuid: uuidSequence('old-owner') });
    c.advance(101);
    await assert.rejects(() => first.renew(), (error) => error.code === 'LEASE_EXPIRED');
    const second = await acquireLease({ resourcePath: join(root, 'resource'), lockPath, ttlMs: 100, staleRecovery: true, clock: c, uuid: uuidSequence('new-owner', 'stale-dir') });
    assert.equal(second.leaseId, 'new-owner');
    const oldRelease = await first.release();
    assert.equal(oldRelease.state, 'released');
    const record = parseLeaseRecord(await readFile(join(lockPath, `owner-${second.leaseId}.json`), 'utf8'));
    assert.equal(record.leaseId, 'new-owner');
    await second.release();
  } finally { await cleanup(root); }
});

test('stale recovery refuses a non-expiring lease', async () => {
  const root = await tempRoot();
  const lockPath = join(root, 'lease.lock');
  try {
    const first = await acquireLease({ resourcePath: join(root, 'resource'), lockPath, uuid: uuidSequence('holder-01') });
    await assert.rejects(() => acquireLease({ resourcePath: join(root, 'resource'), lockPath, staleRecovery: true, uuid: uuidSequence('contender-01') }), (error) => error.code === 'LOCK_BUSY');
    await first.release();
  } finally { await cleanup(root); }
});

test('tampered lock records fail integrity validation and do not become recovery authority', async () => {
  const root = await tempRoot();
  const c = clock();
  const lockPath = join(root, 'lease.lock');
  try {
    const first = await acquireLease({ resourcePath: join(root, 'resource'), lockPath, ttlMs: 100, staleRecovery: true, clock: c, uuid: uuidSequence('owner-0001') });
    const ownerFile = join(lockPath, `owner-${first.leaseId}.json`);
    const serialized = await readFile(ownerFile, 'utf8');
    const tampered = serialized.replace('owner-0001', 'other-0001');
    await writeFile(ownerFile, tampered, 'utf8');
    c.advance(101);
    await assert.rejects(() => acquireLease({ resourcePath: join(root, 'resource'), lockPath, ttlMs: 100, staleRecovery: true, clock: c, uuid: uuidSequence('contender-01') }), (error) => error.code === 'INTEGRITY_MISMATCH');
  } finally { await cleanup(root); }
});

test('release cannot remove a successor owner after lock replacement', async () => {
  const root = await tempRoot();
  const c = clock();
  const lockPath = join(root, 'lease.lock');
  try {
    const old = await acquireLease({ resourcePath: join(root, 'resource'), lockPath, ttlMs: 10, staleRecovery: true, clock: c, uuid: uuidSequence('old-owner-01', 'quarantine-01') });
    c.advance(11);
    const successor = await acquireLease({ resourcePath: join(root, 'resource'), lockPath, ttlMs: 1000, staleRecovery: true, clock: c, uuid: uuidSequence('new-owner-01') });
    const oldRelease = await old.release();
    assert.equal(oldRelease.state, 'released');
    const record = parseLeaseRecord(await readFile(join(lockPath, `owner-${successor.leaseId}.json`), 'utf8'));
    assert.equal(record.leaseId, 'new-owner-01');
    await successor.release();
  } finally { await cleanup(root); }
});

test('rejects malformed, accessor, circular, oversized, and invalid capability inputs before filesystem mutation', async () => {
  const root = await tempRoot();
  const lockPath = join(root, 'lease.lock');
  try {
    assert.throws(() => parseLeaseRecord('{bad'), (error) => error.code === 'MALFORMED_LOCK_RECORD');
    assert.throws(() => parseLeaseRecord(JSON.stringify({ format: FILE_LEASE_FORMAT, payload: '{}', checksum: '0'.repeat(64) })), (error) => error.code === 'INTEGRITY_MISMATCH');
    const accessor = { resourcePath: join(root, 'resource'), lockPath }; Object.defineProperty(accessor, 'owner', { get() { throw new Error('getter must not execute'); } });
    await assert.rejects(() => acquireLease(accessor), (error) => error.code === 'ACCESSOR_INPUT');
    const circular = { resourcePath: join(root, 'resource'), lockPath, owner: {} }; circular.owner.loop = circular;
    await assert.rejects(() => acquireLease(circular), (error) => error.code === 'CIRCULAR_INPUT');
    await assert.rejects(() => acquireLease({ resourcePath: join(root, 'resource'), lockPath, owner: { x: 'x'.repeat(4097) } }), (error) => error.code === 'LIMIT_EXCEEDED');
    await assert.rejects(() => acquireLease({ resourcePath: join(root, 'resource'), lockPath, clock: { now: 1 } }), (error) => error.code === 'INVALID_SEAM');
  } finally { await cleanup(root); }
});

test('serialization is deterministic and immutable', () => {
  const record = { format: FILE_LEASE_FORMAT, leaseId: 'lease-a', resourcePath: '/tmp/resource', lockPath: '/tmp/resource.lock', owner: { b: 2, a: 1 }, acquiredAt: '2026-01-01T00:00:00.000Z', expiresAt: null };
  const first = serializeLeaseRecord(record);
  const second = serializeLeaseRecord({ ...record, owner: { a: 1, b: 2 } });
  assert.equal(first, second);
  const parsed = parseLeaseRecord(first);
  assert.deepEqual(parsed.owner, { a: 1, b: 2 });
  assert.equal(Object.isFrozen(parsed), true);
});

test('failed acquisition does not poison a later independent lease', async () => {
  const root = await tempRoot();
  const badPath = join(root, 'bad', 'resource.lock');
  try {
    await assert.rejects(() => acquireLease({ resourcePath: join(root, 'resource'), lockPath: badPath, uuid: uuidSequence('bad-lock-01') }), (error) => ['ACQUISITION_FAILED', 'ENOENT', 'PERMISSION_DENIED'].includes(error.code));
    const valid = await acquireLease({ resourcePath: join(root, 'resource'), lockPath: join(root, 'good.lock'), uuid: uuidSequence('good-lock-01') });
    assert.equal(valid.leaseId, 'good-lock-01');
    await valid.release();
  } finally { await cleanup(root); }
});
