import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDescriptor, inspectPath, serializeDescriptor, parseDescriptor, PermissionOwnershipError } from '../src/index.js';

const posix = { platform: 'linux', mode: 0o754, uid: 1000, gid: 100, username: 'alice', groupname: 'staff', kind: 'file', link: false };

test('normalizes POSIX metadata deterministically', () => {
  const d = normalizeDescriptor(posix);
  assert.equal(d.platform, 'linux');
  assert.equal(d.permission.mode, 0o754);
  assert.equal(d.ownership.owner.id, 1000);
  assert.equal(d.ownership.owner.name, null);
  assert.equal(Object.isFrozen(d), true);
});

test('owner/group names require explicit opt-in and default to hash redaction', () => {
  const d = normalizeDescriptor(posix, { includeOwnerName: true, includeGroupName: true });
  assert.match(d.ownership.owner.name, /^sha256:[0-9a-f]{64}$/);
  assert.match(d.ownership.group.name, /^sha256:[0-9a-f]{64}$/);
});

test('raw owner names can only be exposed explicitly', () => {
  const d = normalizeDescriptor(posix, { includeOwnerName: true, includeGroupName: true, ownerRedaction: 'none' });
  assert.equal(d.ownership.owner.name, 'alice');
  assert.equal(d.ownership.group.name, 'staff');
});

test('normalizes Windows readonly semantics without inventing POSIX mode', () => {
  const d = normalizeDescriptor({ platform: 'win32', readonly: true, kind: 'file', link: false });
  assert.equal(d.platform, 'windows');
  assert.equal(d.permission.mode, null);
  assert.equal(d.permission.semantic, 'read-only');
});

test('unknown platform remains explicit', () => {
  const d = normalizeDescriptor({ platform: 'plan9', kind: 'file' });
  assert.equal(d.platform, 'other');
});

test('safe integer enforcement rejects invalid owner identifiers', () => {
  assert.throws(() => normalizeDescriptor({ platform: 'linux', uid: Number.MAX_SAFE_INTEGER + 1 }), (e) => e.code === 'INVALID_STAT');
  assert.throws(() => normalizeDescriptor({ platform: 'linux', gid: -1 }), (e) => e.code === 'INVALID_STAT');
});

test('mode validation is strict', () => {
  assert.throws(() => normalizeDescriptor({ platform: 'linux', mode: 0o10000 }), (e) => e.code === 'INVALID_STAT');
});

test('accessor-backed metadata is rejected before getter execution', () => {
  let touched = false;
  const raw = { platform: 'linux' };
  Object.defineProperty(raw, 'uid', { get() { touched = true; return 7; } });
  assert.throws(() => normalizeDescriptor(raw), (e) => e.code === 'ACCESSOR_INPUT');
  assert.equal(touched, false);
});

test('circular metadata is rejected', () => {
  const raw = { platform: 'linux' };
  raw.self = raw;
  assert.throws(() => normalizeDescriptor(raw), (e) => e.code === 'CIRCULAR_INPUT');
});

test('inspectPath uses executable lstat capability and preserves privacy defaults', async () => {
  let called = 0;
  const d = await inspectPath('/tmp/file', { lstat: async (path) => { called++; assert.equal(path, '/tmp/file'); return posix; } });
  assert.equal(called, 1);
  assert.equal(d.ownership.owner.name, null);
});

test('inspectPath rejects malformed capability results', async () => {
  await assert.rejects(() => inspectPath('/tmp/file', { lstat: async () => null }), (e) => e.code === 'INVALID_STAT');
});

test('inspectPath rejects missing capability without touching filesystem', async () => {
  await assert.rejects(() => inspectPath('/tmp/file', {}), (e) => e.code === 'INVALID_CAPABILITY');
});

test('inspectPath rejects invalid paths', async () => {
  await assert.rejects(() => inspectPath('', { lstat: async () => posix }), (e) => e.code === 'INVALID_PATH');
});

test('serialization is deterministic', () => {
  const d = normalizeDescriptor(posix);
  assert.equal(serializeDescriptor(d), serializeDescriptor({ ...d }));
});

test('serialization round-trips to an immutable descriptor', () => {
  const d = normalizeDescriptor(posix);
  const parsed = parseDescriptor(serializeDescriptor(d));
  assert.deepEqual(parsed, d);
  assert.equal(Object.isFrozen(parsed), true);
});

test('serialization detects tampering', () => {
  const s = serializeDescriptor(normalizeDescriptor(posix));
  const tampered = `${s.slice(0, -1)}${s.endsWith('0') ? '1' : '0'}`;
  assert.throws(() => parseDescriptor(tampered), (e) => e.code === 'INTEGRITY_FAILURE');
});

test('serialization rejects malformed input and oversized input', () => {
  assert.throws(() => parseDescriptor('{bad'), (e) => e.code === 'MALFORMED_SERIALIZATION');
  assert.throws(() => parseDescriptor('x'.repeat(40000)), (e) => e.code === 'LIMIT_EXCEEDED');
});

test('serialization result is privacy-preserving by default', () => {
  const s = serializeDescriptor(normalizeDescriptor(posix));
  assert.equal(s.includes('alice'), false);
  assert.equal(s.includes('staff'), false);
});

test('descriptor capability flags reflect supported evidence only', () => {
  const linux = normalizeDescriptor(posix);
  assert.equal(linux.capability.modeBits, true);
  assert.equal(linux.capability.nativeAcl, false);
  const win = normalizeDescriptor({ platform: 'win32', readonly: false });
  assert.equal(win.capability.modeBits, false);
  assert.equal(win.capability.writable, true);
});

test('unknown ownership stays explicit instead of inventing values', () => {
  const d = normalizeDescriptor({ platform: 'windows', readonly: false });
  assert.equal(d.ownership.owner.id, null);
  assert.equal(d.ownership.group.id, null);
  assert.equal(d.ownership.owner.name, null);
});

test('link metadata remains explicit and non-following', () => {
  const d = normalizeDescriptor({ platform: 'linux', mode: 0o777, link: true, kind: 'symlink' });
  assert.equal(d.source.link, true);
  assert.equal(d.source.kind, 'symlink');
});

test('error type is stable and typed', () => {
  assert.throws(() => normalizeDescriptor(null), (e) => e instanceof PermissionOwnershipError && e.code === 'INVALID_STAT');
});
