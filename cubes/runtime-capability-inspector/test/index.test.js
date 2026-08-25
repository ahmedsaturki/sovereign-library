import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectRuntime,
  evaluateRuntimeRequirements,
  serializeRuntimeReport,
  parseRuntimeReport,
  RUNTIME_CAPABILITY_FORMAT,
} from '../src/index.js';

const baseOptions = {
  platform: 'linux',
  arch: 'x64',
  nodeVersion: 'v24.19.0',
  release: 'test-release',
  cpuCount: 8,
  totalMemoryBytes: 16 * 1024 ** 3,
  env: { PATH: '/bin:/usr/bin', PATHEXT: '.COM;.EXE;.BAT;.CMD' },
};

test('captures a bounded immutable runtime snapshot without exposing environment values', () => {
  const snapshot = inspectRuntime({ ...baseOptions, executables: ['node', 'missing-tool'] });
  assert.equal(snapshot.format, RUNTIME_CAPABILITY_FORMAT);
  assert.equal(snapshot.platform.os, 'linux');
  assert.equal(snapshot.platform.architecture, 'x64');
  assert.equal(snapshot.runtime.node.major, 24);
  assert.equal(snapshot.resources.cpuCount, 8);
  assert.equal(snapshot.environment.pathConfigured, true);
  assert.deepEqual(snapshot.environment.executableResults.map((item) => item.name), ['missing-tool', 'node']);
  assert.equal(Object.keys(snapshot.environment).includes('PATH'), false);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.platform), true);
  assert.equal(Object.isFrozen(snapshot.environment.executableResults), true);
});

test('explicit injected environment probing is deterministic and repeated calls are idempotent', () => {
  const one = inspectRuntime({ ...baseOptions, executables: ['node'] });
  const two = inspectRuntime({ ...baseOptions, executables: ['node'] });
  assert.deepEqual(one, two);
});

test('requirement evaluation is pure, ordered, and immutable', () => {
  const snapshot = inspectRuntime(baseOptions);
  const verdict = evaluateRuntimeRequirements(snapshot, {
    os: ['linux'], architectures: ['x64'], nodeMajorMin: 24, nodeMajorMax: 24,
    minCpuCount: 4, minMemoryBytes: 8 * 1024 ** 3,
  });
  assert.equal(verdict.passed, true);
  assert.deepEqual(verdict.failures, []);
  assert.equal(Object.isFrozen(verdict), true);
  assert.equal(Object.isFrozen(verdict.failures), true);
});

test('missing capabilities are represented deterministically as failures', () => {
  const snapshot = inspectRuntime({ ...baseOptions, executables: ['node'] });
  const verdict = evaluateRuntimeRequirements(snapshot, {
    os: ['win32'], architectures: ['arm64'], nodeMajorMin: 25,
    requiredExecutables: ['docker'], minCpuCount: 32, minMemoryBytes: 64 * 1024 ** 3,
  });
  assert.equal(verdict.passed, false);
  assert.deepEqual(verdict.failures.map((item) => item.code), [
    'OS_MISMATCH', 'ARCHITECTURE_MISMATCH', 'NODE_VERSION_TOO_OLD', 'CPU_COUNT_TOO_LOW', 'MEMORY_TOO_LOW', 'EXECUTABLE_MISSING',
  ]);
});

test('rejects duplicates, malformed inputs, accessors, circular data, and impossible bounds', () => {
  assert.throws(() => inspectRuntime({ ...baseOptions, executables: ['node', 'node'] }), (error) => error.code === 'DUPLICATE_EXECUTABLE');
  assert.throws(() => inspectRuntime({ ...baseOptions, executables: ['bad name'] }), (error) => error.code === 'INVALID_EXECUTABLE');
  assert.throws(() => inspectRuntime({ ...baseOptions, nodeVersion: 'bad' }), (error) => error.code === 'INVALID_RUNTIME');
  const accessorEnv = {}; Object.defineProperty(accessorEnv, 'PATH', { get() { throw new Error('getter must not execute'); } });
  assert.throws(() => inspectRuntime({ ...baseOptions, env: accessorEnv }), (error) => error.code === 'ACCESSOR_INPUT');
  const circular = { PATH: '/bin' }; circular.self = circular;
  assert.throws(() => inspectRuntime({ ...baseOptions, env: circular }), (error) => error.code === 'CIRCULAR_INPUT');
  const snapshot = inspectRuntime(baseOptions);
  assert.throws(() => evaluateRuntimeRequirements(snapshot, { nodeMajorMin: 25, nodeMajorMax: 20 }), (error) => error.code === 'INVALID_REQUIREMENT');
});

test('enforces bounded PATH and executable lists', () => {
  const hugePath = Array.from({ length: 129 }, () => '/bin').join(':');
  assert.throws(() => inspectRuntime({ ...baseOptions, env: { PATH: hugePath } }), (error) => error.code === 'LIMIT_EXCEEDED');
  assert.throws(() => inspectRuntime({ ...baseOptions, executables: Array.from({ length: 65 }, (_, i) => `tool-${i}`) }), (error) => error.code === 'LIMIT_EXCEEDED');
});

test('rejected calls do not poison later valid calls', () => {
  assert.throws(() => inspectRuntime({ ...baseOptions, executables: ['node', 'node'] }));
  const valid = inspectRuntime(baseOptions);
  assert.equal(valid.format, RUNTIME_CAPABILITY_FORMAT);
  const verdict = evaluateRuntimeRequirements(valid, { os: ['linux'] });
  assert.equal(verdict.passed, true);
});

test('RCI1 serialization is deterministic and integrity protected', () => {
  const snapshot = inspectRuntime({ ...baseOptions, executables: ['node'] });
  const first = serializeRuntimeReport(snapshot);
  const second = serializeRuntimeReport({
    environment: snapshot.environment,
    resources: snapshot.resources,
    runtime: snapshot.runtime,
    platform: snapshot.platform,
    mode: snapshot.mode,
    format: snapshot.format,
  });
  assert.equal(first, second);
  assert.deepEqual(parseRuntimeReport(first), snapshot);
  const envelope = JSON.parse(first);
  envelope.payload = envelope.payload.replace('runtime_capability_snapshot', 'tampered');
  assert.throws(() => parseRuntimeReport(JSON.stringify(envelope)), (error) => error.code === 'INTEGRITY_MISMATCH');
});

test('malformed serialization fails closed and later valid serialization recovers', () => {
  assert.throws(() => parseRuntimeReport('{bad'), (error) => error.code === 'MALFORMED_SERIALIZATION');
  const snapshot = inspectRuntime(baseOptions);
  const serialized = serializeRuntimeReport(snapshot);
  assert.equal(parseRuntimeReport(serialized).format, RUNTIME_CAPABILITY_FORMAT);
});
