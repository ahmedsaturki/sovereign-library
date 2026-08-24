import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeClock, PriorityHeap, SchedulerCubeError, TaskScheduler } from '../src/index.js';

function flush() {
  return new Promise(resolve => setImmediate(resolve));
}

test('priority heap is stable FIFO within equal priority', () => {
  const heap = new PriorityHeap((a, b) => a.priority - b.priority || a.sequence - b.sequence);
  heap.push({ priority: 2, sequence: 0, id: 'a' });
  heap.push({ priority: 1, sequence: 1, id: 'b' });
  heap.push({ priority: 1, sequence: 2, id: 'c' });
  assert.equal(heap.pop().id, 'b');
  assert.equal(heap.pop().id, 'c');
  assert.equal(heap.pop().id, 'a');
});

test('successful task resolves and stats settle', async () => {
  const scheduler = new TaskScheduler();
  const task = scheduler.submit(() => 42);
  assert.deepEqual(await task.promise, { ok: true, value: 42, attempts: 1, durationMs: 0 });
  assert.equal(task.status, 'completed');
  assert.equal(scheduler.getStats().completed, 1);
});

test('bounded concurrency prevents over-scheduling', async () => {
  const scheduler = new TaskScheduler({ concurrency: 2 });
  let running = 0;
  let peak = 0;
  const tasks = Array.from({ length: 5 }, () => scheduler.submit(async () => {
    running += 1;
    peak = Math.max(peak, running);
    await flush();
    running -= 1;
    return true;
  }));
  await Promise.all(tasks.map(task => task.promise));
  assert.equal(peak, 2);
});

test('priority ordering is preserved', async () => {
  const scheduler = new TaskScheduler();
  const order = [];
  const tasks = [3, 1, 1, 2].map((priority, index) => scheduler.submit(() => {
    order.push(index);
    return index;
  }, { priority }));
  await Promise.all(tasks.map(task => task.promise));
  assert.deepEqual(order, [1, 2, 3, 0]);
});

test('delayed tasks use injected clock deterministically', async () => {
  const clock = new FakeClock(1000);
  const scheduler = new TaskScheduler({ clock });
  let started = false;
  const task = scheduler.submit(() => { started = true; return 'ok'; }, { delayMs: 50 });
  assert.equal(started, false);
  clock.advance(49);
  await flush();
  assert.equal(started, false);
  clock.advance(1);
  await flush();
  assert.equal(await task.promise.then(result => result.value), 'ok');
});

test('retries use deterministic backoff and stop after success', async () => {
  const clock = new FakeClock();
  const scheduler = new TaskScheduler({ clock });
  let attempts = 0;
  const task = scheduler.submit(() => {
    attempts += 1;
    if (attempts < 3) throw new Error('retry');
    return 'done';
  }, { retries: 2, retryBackoff: () => 20 });
  await flush();
  assert.equal(attempts, 1);
  clock.advance(19);
  await flush();
  assert.equal(attempts, 1);
  clock.advance(1);
  await flush();
  assert.equal(attempts, 2);
  clock.advance(20);
  await flush();
  assert.deepEqual(await task.promise, { ok: true, value: 'done', attempts: 3, durationMs: 0 });
});

test('queued cancellation is terminal and prevents execution', async () => {
  const scheduler = new TaskScheduler({ concurrency: 1 });
  let release;
  const blocker = scheduler.submit(() => new Promise(resolve => { release = resolve; }));
  const task = scheduler.submit(() => assert.fail('cancelled task executed'));
  assert.equal(task.cancel(), true);
  assert.equal(task.status, 'cancelled');
  assert.equal((await task.promise).error.code, 'TASK_CANCELLED');
  release();
  await blocker.promise;
});

test('timeout is deterministic with a fake clock', async () => {
  const clock = new FakeClock();
  const scheduler = new TaskScheduler({ clock });
  const task = scheduler.submit(() => new Promise(() => {}), { timeoutMs: 25 });
  await flush();
  clock.advance(25);
  const result = await task.promise;
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'TASK_TIMEOUT');
});

test('idempotency returns the same handle', async () => {
  const scheduler = new TaskScheduler();
  let calls = 0;
  const first = scheduler.submit(() => { calls += 1; return calls; }, { idempotencyKey: 'same' });
  const second = scheduler.submit(() => { calls += 100; return calls; }, { idempotencyKey: 'same' });
  assert.strictEqual(first, second);
  assert.deepEqual(await first.promise, { ok: true, value: 1, attempts: 1, durationMs: 0 });
});

test('external abort cancels a running task', async () => {
  const scheduler = new TaskScheduler();
  const controller = new AbortController();
  const task = scheduler.submit(signal => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('stopped')), { once: true });
  }), { signal: controller.signal });
  controller.abort();
  const result = await task.promise;
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'TASK_ABORTED');
});

test('drain stops new submissions and waits for existing work', async () => {
  const scheduler = new TaskScheduler({ concurrency: 1 });
  let release;
  const task = scheduler.submit(() => new Promise(resolve => { release = resolve; }));
  const draining = scheduler.drain();
  assert.throws(() => scheduler.submit(() => 1), error => error instanceof SchedulerCubeError && error.code === 'SHUTTING_DOWN');
  release();
  await task.promise;
  await draining;
  assert.equal(scheduler.getStats().running, 0);
});

test('shutdown cancels queued work', async () => {
  const scheduler = new TaskScheduler({ concurrency: 1 });
  let release;
  const running = scheduler.submit(() => new Promise(resolve => { release = resolve; }));
  const queued = scheduler.submit(() => 2);
  await scheduler.shutdown();
  assert.equal(queued.status, 'cancelled');
  assert.equal((await queued.promise).error.code, 'TASK_CANCELLED');
  release();
  assert.equal((await running.promise).error.code, 'TASK_ABORTED');
});

test('validation is deterministic', () => {
  assert.throws(() => new TaskScheduler({ concurrency: 0 }), error => error.code === 'INVALID_CONCURRENCY');
  const scheduler = new TaskScheduler();
  assert.throws(() => scheduler.submit('x'), error => error.code === 'INVALID_FN');
  assert.throws(() => scheduler.submit(() => 1, { delayMs: -1 }), error => error.code === 'INVALID_DELAY');
  assert.throws(() => scheduler.submit(() => 1, { timeoutMs: 0 }), error => error.code === 'INVALID_TIMEOUT');
});
