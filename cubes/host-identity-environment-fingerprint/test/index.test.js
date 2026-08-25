import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  fingerprintHost,
  serializeHostFingerprint,
  compareHostFingerprints,
  HOST_IDENTITY_FORMAT,
} from '../src/index.js';

const base = (overrides = {}) => ({
  platform: { platform: () => 'linux', architecture: () => 'x64', release: () => ({ status: 'available', value: '6.8-test' }) },
  runtime: { family: () => 'node', version: () => 'v24.1.2' },
  path: { separator: () => '/', caseSensitivity: () => 'sensitive' },
  clock: { now: () => 1756123200000 },
  ...overrides,
});

const knownHash = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;

test('creates deterministic stable identity and separates volatile fields', async () => {
  const one = await fingerprintHost(base());
  const two = await fingerprintHost(base());
  assert.equal(one.format, HOST_IDENTITY_FORMAT);
  assert.equal(one.identity, two.identity);
  assert.deepEqual(one.stable, two.stable);
  assert.equal(one.volatile.capturedAt.value, '2025-08-25T12:00:00.000Z');
  assert.equal(one.stable.runtimeMajor.value, 24);
  assert.ok(Object.isFrozen(one));
  assert.ok(Object.isFrozen(one.stable));
});

test('capability containers allow functions without recursively freezing or validating them as data', async () => {
  const calls = [];
  const snap = await fingerprintHost(base({
    platform: {
      platform: () => { calls.push('platform'); return 'win32'; },
      architecture: () => 'arm64',
      release: () => ({ status: 'available', value: '10.0' }),
    },
  }));
  assert.equal(snap.stable.osFamily.value, 'win32');
  assert.deepEqual(calls, ['platform']);
});

test('privacy defaults never require environment enumeration', async () => {
  const snap = await fingerprintHost(base());
  assert.deepEqual(snap.stable.environment, {});
});

test('opt-in environment allowlist is bounded and rejects sensitive names', async () => {
  const snap = await fingerprintHost(base({ environment: { allowlist: ['APP_MODE'], values: { APP_MODE: 'test', SECRET_TOKEN: 'blocked' } } }));
  assert.equal(snap.stable.environment.APP_MODE.value, 'test');
  await assert.rejects(
    fingerprintHost(base({ environment: { allowlist: ['SECRET_TOKEN'], values: { SECRET_TOKEN: 'x' } } })),
    (error) => error.code === 'DISALLOWED_SENSITIVE_FIELD',
  );
});

test('missing and permission-denied capabilities remain explicit', async () => {
  const snap = await fingerprintHost(base({
    platform: { platform: () => 'linux', architecture: () => 'x64', release: () => ({ status: 'permission_denied' }) },
    path: { separator: () => '/', caseSensitivity: () => ({ status: 'unavailable' }) },
  }));
  assert.equal(snap.stable.platformRelease.status, 'permission_denied');
  assert.equal(snap.stable.filesystemCaseSensitivity.status, 'unavailable');
});

test('invalid capability results fail closed', async () => {
  await assert.rejects(fingerprintHost(base({ path: { separator: () => '\\0', caseSensitivity: () => 'sensitive' } })), (error) => error.code === 'INVALID_CAPABILITY_RESULT');
  await assert.rejects(fingerprintHost(base({ runtime: { family: () => 'node', version: () => 'not-a-version' } })), (error) => error.code === 'INVALID_CAPABILITY_RESULT');
});

test('custom hash must preserve the HIF1 sha256 contract', async () => {
  const raw = await fingerprintHost(base());
  const custom = await fingerprintHost(base({ hash: (serialized) => knownHash(serialized) }));
  assert.equal(custom.identity, raw.identity);
  await assert.rejects(fingerprintHost(base({ hash: () => 'sha256:bad' })), (error) => error.code === 'INVALID_DIGEST');
});

test('serialization is deterministic and stable identity is independently reproducible', async () => {
  const snap = await fingerprintHost(base());
  assert.deepEqual(JSON.parse(snap.serialization), snap.stable);
  assert.equal(snap.identity, knownHash(snap.serialization));
  const full = serializeHostFingerprint(snap);
  assert.equal(typeof full, 'string');
});

test('comparison ignores volatile values by default and reports verbose volatility when requested', async () => {
  const one = await fingerprintHost(base({ clock: { now: () => 1756123200000 } }));
  const two = await fingerprintHost(base({ clock: { now: () => 1756123260000 } }));
  assert.deepEqual(compareHostFingerprints(one, two), { format: HOST_IDENTITY_FORMAT, verdict: 'same_identity' });
  const verbose = compareHostFingerprints(one, two, { verbose: true });
  assert.equal(verbose.verdict, 'same_identity');
  assert.equal(verbose.differences[0].section, 'volatile');
});

test('comparison returns different_identity for stable divergence and bounded diffs', async () => {
  const one = await fingerprintHost(base());
  const two = await fingerprintHost(base({ platform: { platform: () => 'darwin', architecture: () => 'x64', release: () => ({ status: 'available', value: '24A' }) } }));
  const result = compareHostFingerprints(one, two, { verbose: true });
  assert.equal(result.verdict, 'different_identity');
  assert.ok(result.differences.some((diff) => diff.path === 'osFamily.value'));
  assert.ok(result.differences.length <= 64);
});

test('comparison detects tampered fingerprints as invalid', async () => {
  const snap = await fingerprintHost(base());
  const tampered = { ...snap, identity: 'sha256:' + '0'.repeat(64) };
  assert.deepEqual(compareHostFingerprints(tampered, snap), { format: HOST_IDENTITY_FORMAT, verdict: 'invalid' });
});

test('accessors, circular input, and oversized values fail before capability execution', async () => {
  const accessorOptions = {};
  Object.defineProperty(accessorOptions, 'platform', { get() { throw new Error('must not execute'); } });
  await assert.rejects(fingerprintHost(accessorOptions), (error) => error.code === 'ACCESSOR_INPUT');

  const circular = {};
  circular.self = circular;
  await assert.rejects(fingerprintHost(base({ environment: { allowlist: [], values: circular } })), (error) => error.code === 'CIRCULAR_INPUT');

  await assert.rejects(
    fingerprintHost(base({ environment: { allowlist: ['A'], values: { A: 'x'.repeat(2049) } } })),
    (error) => error.code === 'FIELD_TOO_LARGE',
  );
});
