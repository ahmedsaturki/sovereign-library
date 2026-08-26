import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDescriptor, inspectPath, serializeDescriptor, parseDescriptor, createNodeCapabilities, PermissionOwnershipError } from '../src/index.js';

const posix = { path: '/tmp/example.txt', platform: 'linux', mode: 0o754, uid: 1000, gid: 100, username: 'alice', groupname: 'staff', kind: 'file', link: false };

 test('normalizes POSIX mode and tri-state permissions deterministically', () => {
  const d = normalizeDescriptor(posix);
  assert.equal(d.platform, 'linux');
  assert.equal(d.mode, 0o754);
  assert.equal(d.readable, true);
  assert.equal(d.writable, true);
  assert.equal(d.executable, true);
  assert.equal(d.owner.id, null);
  assert.equal(d.owner.name, null);
  assert.equal(d.owner.state, 'redacted');
  assert.equal(Object.isFrozen(d), true);
});

test('owner/group disclosure requires explicit opt-in', () => {
  const hashed = normalizeDescriptor(posix, { includeOwnerName: true, includeGroupName: true });
  assert.match(hashed.owner.name, /^sha256:[0-9a-f]{64}$/);
  assert.match(hashed.group.name, /^sha256:[0-9a-f]{64}$/);
  const raw = normalizeDescriptor(posix, { includeOwnerName: true, includeGroupName: true, ownerRedaction: 'none' });
  assert.equal(raw.owner.name, 'alice');
  assert.equal(raw.group.name, 'staff');
});

test('opaque owner identifiers support bounded string and numeric forms', () => {
  const hidden = normalizeDescriptor({ ...posix, uid: 'S-1-5-21-123', gid: 100 });
  assert.equal(hidden.owner.id, null);
  assert.equal(hidden.owner.state, 'redacted');
  const shown = normalizeDescriptor({ ...posix, uid: 'S-1-5-21-123' }, { includeOwnerId: true });
  assert.equal(shown.owner.id, 'S-1-5-21-123');
  assert.equal(shown.owner.state, 'known');
});

test('Windows readonly semantics do not fabricate POSIX mode', () => {
  const d = normalizeDescriptor({ path: 'C:\\tmp\\file.txt', platform: 'win32', readonly: true, kind: 'file' });
  assert.equal(d.platform, 'windows');
  assert.equal(d.mode, null);
  assert.equal(d.readable, 'unknown');
  assert.equal(d.writable, false);
  assert.equal(d.executable, 'unknown');
  assert.equal(d.permission.semantic, 'read-only');
});

test('unsupported platforms and filesystems remain explicit', () => {
  const d = normalizeDescriptor({ path: '/tmp/file', platform: 'plan9', kind: 'file' });
  assert.equal(d.platform, 'other');
  assert.equal(d.acl, 'unsupported');
});

test('ACL availability is explicit and bounded', () => {
  assert.equal(normalizeDescriptor({ path: '/tmp/a', platform: 'linux', mode: 0o644, acl: [] }).acl, 'available');
  assert.equal(normalizeDescriptor({ path: '/tmp/a', platform: 'linux', mode: 0o644, aclState: 'unavailable' }).acl, 'unavailable');
  assert.equal(normalizeDescriptor({ path: '/tmp/a', platform: 'linux', mode: 0o644, aclUnsupported: true }).acl, 'unsupported');
  assert.throws(() => normalizeDescriptor({ path: '/tmp/a', platform: 'linux', mode: 0o644, acl: 'bad' }), (e) => e.code === 'MALFORMED_CAPABILITY_RESULT');
});

test('platform flags are normalized, sorted, unique and bounded', () => {
  const d = normalizeDescriptor({ path: '/tmp/a', platform: 'linux', mode: 0o644, flags: ['immutable', 'hidden', 'immutable'] });
  assert.deepEqual(d.flags, ['hidden', 'immutable']);
  assert.equal(d.capabilities.flags, true);
  assert.throws(() => normalizeDescriptor({ path: '/tmp/a', platform: 'linux', mode: 0o644, flags: Array(65).fill('x') }), (e) => e.code === 'LIMIT_EXCEEDED');
});

test('invalid numeric identifiers and modes fail closed', () => {
  assert.throws(() => normalizeDescriptor({ ...posix, uid: Number.MAX_SAFE_INTEGER + 1 }), (e) => e.code === 'MALFORMED_CAPABILITY_RESULT');
  assert.throws(() => normalizeDescriptor({ ...posix, gid: -1 }), (e) => e.code === 'MALFORMED_CAPABILITY_RESULT');
  assert.throws(() => normalizeDescriptor({ ...posix, mode: 0o10000 }), (e) => e.code === 'INVALID_STAT');
});

test('accessor-backed metadata is rejected before getter execution', () => {
  let touched = false;
  const raw = { ...posix };
  Object.defineProperty(raw, 'uid', { get() { touched = true; return 7; } });
  assert.throws(() => normalizeDescriptor(raw), (e) => e.code === 'ACCESSOR_INPUT');
  assert.equal(touched, false);
});

test('circular metadata is rejected', () => {
  const raw = { ...posix };
  raw.self = raw;
  assert.throws(() => normalizeDescriptor(raw), (e) => e.code === 'CIRCULAR_INPUT');
});

test('inspectPath is read-only, capability-driven and privacy-safe', async () => {
  let calls = 0;
  const caps = createNodeCapabilities({
    lstat: async (path) => { calls++; assert.equal(path, '/tmp/file'); return posix; },
    platform: () => 'linux',
    clock: () => '2026-08-26T00:00:00.000Z',
    hash: (value) => 'a'.repeat(64),
  });
  const d = await inspectPath('/tmp/file', caps);
  assert.equal(calls, 1);
  assert.equal(d.path, '/tmp/file');
  assert.equal(d.observedAt, '2026-08-26T00:00:00.000Z');
  assert.equal(d.owner.name, null);
});

test('relative paths require explicit root-resolution capability', async () => {
  await assert.rejects(() => inspectPath('relative.txt', { lstat: async () => posix }), (e) => e.code === 'PATH_ROOT_ESCAPE');
  let resolved = false;
  const d = await inspectPath('relative.txt', { resolvePath: (p) => { resolved = p === 'relative.txt'; return '/safe/relative.txt'; }, lstat: async () => posix });
  assert.equal(resolved, true);
  assert.equal(d.path, '/safe/relative.txt');
});

test('containment and cancellation fail closed without mutation', async () => {
  await assert.rejects(() => inspectPath('/tmp/file', { validatePath: () => false, lstat: async () => posix }), (e) => e.code === 'PATH_ROOT_ESCAPE');
  let touched = false;
  await assert.rejects(() => inspectPath('/tmp/file', { cancelled: () => true, lstat: async () => { touched = true; return posix; } }), (e) => e.code === 'CANCELLED');
  assert.equal(touched, false);
});

test('malformed capability results and platform mismatch are typed', async () => {
  await assert.rejects(() => inspectPath('/tmp/file', { lstat: async () => null }), (e) => e.code === 'MALFORMED_CAPABILITY_RESULT');
  await assert.rejects(() => inspectPath('/tmp/file', { platform: () => 'windows', lstat: async () => ({ ...posix, platform: 'linux' }) }), (e) => e.code === 'PLATFORM_MISMATCH');
});

test('serialization is deterministic, bounded, integrity-protected and immutable', () => {
  const d = normalizeDescriptor(posix);
  const s1 = serializeDescriptor(d);
  const s2 = serializeDescriptor({ ...d });
  assert.equal(s1, s2);
  const parsed = parseDescriptor(s1);
  assert.deepEqual(parsed, d);
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.owner), true);
  const tampered = `${s1.slice(0, -1)}${s1.endsWith('0') ? '1' : '0'}`;
  assert.throws(() => parseDescriptor(tampered), (e) => e.code === 'INTEGRITY_FAILURE');
});

test('serialization rejects malformed and oversized input without leaking identity', () => {
  const s = serializeDescriptor(normalizeDescriptor(posix));
  assert.equal(s.includes('alice'), false);
  assert.equal(s.includes('staff'), false);
  assert.throws(() => parseDescriptor('{bad'), (e) => e.code === 'MALFORMED_SERIALIZATION');
  assert.throws(() => parseDescriptor('x'.repeat(40000)), (e) => e.code === 'LIMIT_EXCEEDED');
});

test('bounded path and identity limits are enforced', () => {
  assert.throws(() => normalizeDescriptor({ ...posix, path: 'x'.repeat(4097) }), (e) => e.code === 'LIMIT_EXCEEDED');
  assert.throws(() => normalizeDescriptor({ ...posix, username: 'x'.repeat(513) }), (e) => e.code === 'LIMIT_EXCEEDED');
});

test('node type and symlink state remain explicit', () => {
  const d = normalizeDescriptor({ path: '/tmp/link', platform: 'linux', mode: 0o777, kind: 'symlink', link: true });
  assert.equal(d.nodeType, 'symlink');
  assert.equal(d.source.link, true);
});

test('typed error surface is stable', () => {
  assert.throws(() => normalizeDescriptor(null), (e) => e instanceof PermissionOwnershipError && e.code === 'INVALID_STAT');
});
