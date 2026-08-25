import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { acquireLease, FileLeaseError } from '../src/index.js';

async function tempRoot() { return (await import('node:fs/promises')).mkdtemp(join(tmpdir(), 'flc-review-')); }
function clock(start = 1_700_000_000_000) { let now = start; return { now: () => now, advance: (ms) => { now += ms; } }; }
function uuidSequence(...ids) { let i = 0; return () => ids[i++ % ids.length]; }
async function cleanup(root) { await rm(root, { recursive: true, force: true }); }

test('a recovered successor invalidates renew on the old lease object', async () => {
  const root = await tempRoot();
  const clockStub = clock();
  const lockPath = join(root, 'lease.lock');
  try {
    const old = await acquireLease({ resourcePath: join(root, 'resource'), lockPath, ttlMs: 10, staleRecovery: true, clock: clockStub, uuid: uuidSequence('old-owner', 'quarantine') });
    clockStub.advance(11);
    const successor = await acquireLease({ resourcePath: join(root, 'resource'), lockPath, ttlMs: 1000, staleRecovery: true, clock: clockStub, uuid: uuidSequence('new-owner') });
    await assert.rejects(() => old.renew(), (error) => error instanceof FileLeaseError && error.code === 'OWNERSHIP_LOST');
    const envelope = JSON.parse(await readFile(join(lockPath, `owner-${successor.leaseId}.json`), 'utf8'));
    assert.equal(JSON.parse(envelope.payload).leaseId, 'new-owner');
    await successor.release();
    await old.release();
  } finally { await cleanup(root); }
});

test('stale recovery fails closed when a lock directory has no owner record', async () => {
  const root = await tempRoot();
  const lockPath = join(root, 'orphan.lock');
  try {
    await mkdir(lockPath);
    await assert.rejects(() => acquireLease({ resourcePath: join(root, 'resource'), lockPath, ttlMs: 100, staleRecovery: true, uuid: uuidSequence('contender') }), (error) => error instanceof FileLeaseError && error.code === 'STALE_RECOVERY_REJECTED');
  } finally { await cleanup(root); }
});

test('release fails before deleting ownership when unexpected lock-directory entries exist', async () => {
  const root = await tempRoot();
  const lockPath = join(root, 'lease.lock');
  try {
    const lease = await acquireLease({ resourcePath: join(root, 'resource'), lockPath, uuid: uuidSequence('owner-0001') });
    await writeFile(join(lockPath, 'unexpected.tmp'), 'x', 'utf8');
    await assert.rejects(() => lease.release(), (error) => error instanceof FileLeaseError && error.code === 'RELEASE_FAILED');
    const ownerPath = join(lockPath, `owner-${lease.leaseId}.json`);
    await readFile(ownerPath, 'utf8');
    await rm(join(lockPath, 'unexpected.tmp'), { force: true });
    const released = await lease.release();
    assert.equal(released.state, 'released');
  } finally { await cleanup(root); }
});
