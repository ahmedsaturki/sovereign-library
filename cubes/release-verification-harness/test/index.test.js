import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerificationHarness, VerificationError } from '../src/index.js';

const node = process.execPath;

const stage = (id, code, extra = {}) => ({ id, command: node, args: ['-e', code], ...extra });

test('runs deterministic stages and aggregates required verdict', async () => {
  const harness = createVerificationHarness({ stages: [
    stage('b', 'process.stdout.write("B")'),
    stage('a', 'process.stdout.write("A")'),
  ] });
  const result = await harness.run();
  assert.equal(result.verdict, 'passed');
  assert.deepEqual(Object.keys(result.stages), ['a', 'b']);
  assert.equal(result.stages.a.stdout, 'A');
});

test('retries failed stages and recovers deterministically', async () => {
  const harness = createVerificationHarness({ stages: [
    stage('retry', 'if (!process.env.OK) process.exit(3);', { retries: 1, env: { OK: '1' } }),
  ] });
  const result = await harness.run();
  assert.equal(result.verdict, 'passed');
  assert.equal(result.stages.retry.attempts, 1);
});

test('timeout is terminal failure and optional stages do not fail verdict', async () => {
  const harness = createVerificationHarness({ stages: [
    stage('optional-timeout', 'setTimeout(() => {}, 1000)', { timeoutMs: 10, required: false }),
  ] });
  const result = await harness.run();
  assert.equal(result.verdict, 'passed');
  assert.equal(result.stages['optional-timeout'].status, 'timed_out');
});

test('cancellation prevents later stages', async () => {
  const harness = createVerificationHarness({ stages: [
    stage('first', 'setTimeout(() => {}, 50)'),
    stage('second', 'process.stdout.write("ran")'),
  ] });
  const running = harness.run();
  harness.cancel();
  const result = await running;
  assert.equal(result.stages.second.status, 'cancelled');
});

test('rejects unsafe definitions before command execution', () => {
  assert.throws(() => createVerificationHarness({ stages: [{ id: 'x', command: 'echo;rm', args: [] }] }), e => e instanceof VerificationError && e.code === 'INVALID_COMMAND');
  assert.throws(() => createVerificationHarness({ stages: [{ id: 'x', command: node, args: [] }, { id: 'x', command: node, args: [] }] }), /Duplicate stage/);
});

test('bounds and configuration are immutable', () => {
  const harness = createVerificationHarness({ stages: [stage('x', 'process.stdout.write("x")')] }, { limits: { maxStages: 2 } });
  assert.ok(Object.isFrozen(harness));
  assert.ok(Object.isFrozen(harness.stages));
  assert.throws(() => createVerificationHarness({ stages: [stage('x', '0')] }, { limits: { maxOutputBytes: 0 } }), VerificationError);
});
