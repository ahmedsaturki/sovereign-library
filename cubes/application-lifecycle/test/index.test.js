import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationLifecycle, ApplicationLifecycleError } from '../src/index.js';

const caps = () => {
  let now = 1_000;
  let id = 0;
  return {
    now: () => now,
    identity: () => `tx-${++id}`,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (timer) => clearTimeout(timer),
    advance: (ms) => { now += ms; },
  };
};

function participant(log, id, priority = 0, timeoutMs = 100, close = null) {
  return { registration: { id, priority, timeoutMs }, capability: { close: close ?? (() => { log.push(id); }) } };
}

test('registers participants and orders shutdown deterministically', async () => {
  const c = caps();
  const lifecycle = createApplicationLifecycle({}, c);
  const log = [];
  lifecycle.register(participant(log, 'low', 1).registration, participant(log, 'low', 1).capability);
  lifecycle.register(participant(log, 'high', 3).registration, participant(log, 'high', 3).capability);
  lifecycle.register(participant(log, 'same-a', 2).registration, participant(log, 'same-a', 2).capability);
  lifecycle.register(participant(log, 'same-b', 2).registration, participant(log, 'same-b', 2).capability);
  const result = await lifecycle.shutdown();
  assert.deepEqual(log, ['high', 'same-a', 'same-b', 'low']);
  assert.equal(result.state, 'stopped');
  assert.equal(result.successCount, 4);
});

test('duplicate ids are rejected before capability execution', () => {
  const lifecycle = createApplicationLifecycle();
  const close = () => assert.fail('capability must not execute');
  lifecycle.register({ id: 'x' }, { close });
  assert.throws(() => lifecycle.register({ id: 'x' }, { close }), error => error instanceof ApplicationLifecycleError && error.code === 'DUPLICATE_PARTICIPANT');
});

test('participant timeout is isolated and shutdown can continue', async () => {
  const c = caps();
  const lifecycle = createApplicationLifecycle({ defaultTimeoutMs: 10, globalShutdownTimeoutMs: 100 }, c);
  const order = [];
  lifecycle.register({ id: 'slow', priority: 2, timeoutMs: 5 }, { close: () => new Promise(() => {}) });
  lifecycle.register({ id: 'fast', priority: 1 }, { close: () => { order.push('fast'); } });
  const result = await lifecycle.shutdown();
  assert.equal(result.state, 'failed');
  assert.equal(result.timedOutCount, 1);
  assert.deepEqual(order, ['fast']);
});

test('global deadline skips participants that cannot start in time', async () => {
  const c = caps();
  const lifecycle = createApplicationLifecycle({ globalShutdownTimeoutMs: 10 }, c);
  const called = [];
  lifecycle.register({ id: 'one', timeoutMs: 100 }, { close: async () => { called.push('one'); c.advance(11); } });
  lifecycle.register({ id: 'two', timeoutMs: 100 }, { close: async () => { called.push('two'); } });
  const result = await lifecycle.shutdown();
  assert.deepEqual(called, ['one']);
  assert.equal(result.skippedCount, 1);
});

test('fail-fast policy skips later participants after failure', async () => {
  const lifecycle = createApplicationLifecycle({ policy: 'fail-fast' });
  const called = [];
  lifecycle.register({ id: 'bad', priority: 2 }, { close: () => { called.push('bad'); throw new Error('boom'); } });
  lifecycle.register({ id: 'later', priority: 1 }, { close: () => { called.push('later'); } });
  const result = await lifecycle.shutdown();
  assert.deepEqual(called, ['bad']);
  assert.equal(result.failedCount, 1);
  assert.equal(result.skippedCount, 1);
});

test('concurrent shutdown callers share the same transaction', async () => {
  const lifecycle = createApplicationLifecycle();
  let calls = 0;
  lifecycle.register({ id: 'x' }, { close: async () => { calls += 1; await Promise.resolve(); } });
  const first = lifecycle.shutdown();
  const second = lifecycle.shutdown();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
});

test('repeated shutdown after stopped is idempotent', async () => {
  const lifecycle = createApplicationLifecycle();
  lifecycle.register({ id: 'x' }, { close: () => {} });
  const first = await lifecycle.shutdown();
  const second = await lifecycle.shutdown();
  assert.deepEqual(first, second);
  assert.equal(second.state, 'stopped');
});

test('pre-aborted shutdown fails before participant invocation', async () => {
  const lifecycle = createApplicationLifecycle();
  let called = false;
  lifecycle.register({ id: 'x' }, { close: () => { called = true; } });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(lifecycle.shutdown({ signal: controller.signal }), error => error instanceof ApplicationLifecycleError && error.code === 'CANCELLED');
  assert.equal(called, false);
});

test('active cancellation stops admitting new participants', async () => {
  const lifecycle = createApplicationLifecycle({ globalShutdownTimeoutMs: 100 }, caps());
  let release;
  const blocker = new Promise((resolve) => { release = resolve; });
  const calls = [];
  lifecycle.register({ id: 'first' }, { close: () => blocker });
  lifecycle.register({ id: 'second' }, { close: () => { calls.push('second'); } });
  const controller = new AbortController();
  const pending = lifecycle.shutdown({ signal: controller.signal });
  controller.abort();
  release();
  const result = await pending;
  assert.equal(result.cancelledCount >= 1, true);
  assert.deepEqual(calls, []);
});

test('late participant completion cannot mutate the terminal snapshot', async () => {
  const lifecycle = createApplicationLifecycle({ defaultTimeoutMs: 5 });
  let finish;
  lifecycle.register({ id: 'late' }, { close: () => new Promise((resolve) => { finish = resolve; }) });
  const result = await lifecycle.shutdown();
  const before = lifecycle.snapshot();
  finish('too late');
  await Promise.resolve();
  const after = lifecycle.snapshot();
  assert.deepEqual(after, before);
  assert.equal(result.timedOutCount, 1);
});

test('accessor and circular data are rejected before capability execution', () => {
  const lifecycle = createApplicationLifecycle();
  const accessor = {};
  Object.defineProperty(accessor, 'id', { get() { throw new Error('getter'); } });
  assert.throws(() => lifecycle.register(accessor, { close: () => {} }), error => error instanceof ApplicationLifecycleError && error.code === 'ACCESSOR_INPUT');
  const circular = { id: 'c' }; circular.self = circular;
  assert.throws(() => lifecycle.register(circular, { close: () => {} }), error => error instanceof ApplicationLifecycleError && error.code === 'CIRCULAR_INPUT');
});

test('snapshots and registered metadata are immutable', () => {
  const lifecycle = createApplicationLifecycle();
  const registered = lifecycle.register({ id: 'x', metadata: { role: 'db' } }, { close: () => {} });
  assert.equal(Object.isFrozen(registered), true);
  assert.equal(Object.isFrozen(registered.metadata), true);
  const snapshot = lifecycle.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.participants), true);
});

test('registration is rejected after shutdown begins and close is terminal', async () => {
  const lifecycle = createApplicationLifecycle();
  lifecycle.register({ id: 'x' }, { close: () => {} });
  const pending = lifecycle.shutdown();
  await pending;
  assert.throws(() => lifecycle.register({ id: 'y' }, { close: () => {} }), error => error instanceof ApplicationLifecycleError && error.code === 'INVALID_TRANSITION');
  lifecycle.close();
  assert.throws(() => lifecycle.register({ id: 'z' }, { close: () => {} }), error => error instanceof ApplicationLifecycleError && error.code === 'COORDINATOR_CLOSED');
});

test('bounds are enforced and later valid instances recover', () => {
  assert.throws(() => createApplicationLifecycle({ maxParticipants: 0 }), ApplicationLifecycleError);
  const lifecycle = createApplicationLifecycle({ maxParticipants: 1 });
  lifecycle.register({ id: 'x' }, { close: () => {} });
  assert.throws(() => lifecycle.register({ id: 'y' }, { close: () => {} }), error => error instanceof ApplicationLifecycleError && error.code === 'BOUNDS_EXCEEDED');
  const second = createApplicationLifecycle();
  assert.equal(second.snapshot().state, 'idle');
});
