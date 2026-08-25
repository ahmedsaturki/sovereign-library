import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerPool, DEFAULT_MAX_QUEUE, DEFAULT_SIZE, DEFAULT_TASK_TIMEOUT_MS, WorkerPoolError } from '../src/index.js';

const workerModule = new URL('./worker.js', import.meta.url);

test('worker pool executes tasks and returns structured-clone results', async () => {
  const pool = createWorkerPool({ size: 2, workerModule });
  try {
    assert.equal(await pool.submit({ type: 'multiply', value: 7, factor: 6 }), 42);
    assert.deepEqual(await pool.submit({ nested: { value: 'ok' }, bytes: Uint8Array.from([1, 2, 3]) }), { nested: { value: 'ok' }, bytes: Uint8Array.from([1, 2, 3]) });
  } finally {
    await pool.close();
  }
});

test('pool limits concurrency and keeps FIFO admission order', async () => {
  const pool = createWorkerPool({ size: 1, workerModule });
  try {
    const first = pool.submit({ type: 'sleep', ms: 20, value: 1 });
    const second = pool.submit({ type: 'multiply', value: 2, factor: 2 });
    const third = pool.submit({ type: 'multiply', value: 3, factor: 2 });
    assert.deepEqual(await first, { type: 'sleep', ms: 20, value: 1 });
    assert.equal(await second, 4);
    assert.equal(await third, 6);
  } finally {
    await pool.close();
  }
});

test('queue overflow rejects without enqueueing', async () => {
  const pool = createWorkerPool({ size: 1, maxQueue: 1, workerModule });
  try {
    const running = pool.submit({ type: 'sleep', ms: 50 });
    const queued = pool.submit({ type: 'sleep', ms: 10 });
    const overflow = await pool.submit({ type: 'sleep', ms: 10 }).then(() => null, error => error);
    assert.equal(overflow?.code, 'QUEUE_FULL');
    await running;
    await queued;
  } finally {
    await pool.close();
  }
});

test('queued cancellation rejects before worker execution', async () => {
  const pool = createWorkerPool({ size: 1, maxQueue: 2, workerModule });
  const controller = new AbortController();
  try {
    const running = pool.submit({ type: 'sleep', ms: 50 });
    const queued = pool.submit({ type: 'sleep', ms: 10 }, { signal: controller.signal });
    controller.abort();
    const cancelled = await queued.then(() => null, error => error);
    assert.equal(cancelled?.code, 'CANCELLED');
    assert.equal(cancelled?.statusCode, 499);
    await running;
  } finally {
    await pool.close();
  }
});

test('active cancellation terminates the worker and the pool recovers', async () => {
  const pool = createWorkerPool({ size: 1, workerModule });
  const controller = new AbortController();
  try {
    const running = pool.submit({ type: 'sleep', ms: 200 }, { signal: controller.signal });
    await new Promise(resolve => setTimeout(resolve, 20));
    controller.abort();
    const cancelled = await running.then(() => null, error => error);
    assert.equal(cancelled?.code, 'CANCELLED');
    assert.equal(cancelled?.statusCode, 499);
    assert.equal(await pool.submit({ type: 'multiply', value: 9, factor: 3 }), 27);
  } finally {
    await pool.close();
  }
});

test('worker handler failures are surfaced without killing the pool', async () => {
  const pool = createWorkerPool({ size: 1, workerModule });
  try {
    const failure = await pool.submit({ type: 'fail', message: 'boom', code: 'EXPECTED' }).then(() => null, error => error);
    assert.equal(failure?.name, 'Error');
    assert.equal(failure?.message, 'boom');
    assert.equal(failure?.code, 'EXPECTED');
    assert.equal(await pool.submit({ type: 'multiply', value: 5, factor: 5 }), 25);
  } finally {
    await pool.close();
  }
});

test('real worker crashes are surfaced and the worker is replaced', async () => {
  const pool = createWorkerPool({ size: 1, workerModule });
  try {
    const failure = await pool.submit({ type: 'crash', code: 17 }).then(() => null, error => error);
    assert.ok(failure instanceof WorkerPoolError);
    assert.ok(['WORKER_FAILED', 'WORKER_EXITED'].includes(failure.code));
    assert.equal(await pool.submit({ type: 'multiply', value: 6, factor: 7 }), 42);
  } finally {
    await pool.close();
  }
});

test('task timeout terminates and replaces the worker', async () => {
  const pool = createWorkerPool({ size: 1, workerModule, taskTimeoutMs: 20 });
  try {
    const timeoutError = await pool.submit({ type: 'sleep', ms: 100 }).then(() => null, error => error);
    assert.equal(timeoutError?.code, 'TASK_TIMEOUT');
    assert.equal(timeoutError?.statusCode, 408);
    assert.equal(await pool.submit({ type: 'multiply', value: 4, factor: 3 }), 12);
  } finally {
    await pool.close();
  }
});

test('drain stops new submissions and waits for active work', async () => {
  const pool = createWorkerPool({ size: 1, workerModule });
  const task = pool.submit({ type: 'sleep', ms: 25, value: 1 });
  await pool.drain();
  assert.deepEqual(await task, { type: 'sleep', ms: 25, value: 1 });
  const closed = await pool.submit({ type: 'multiply', value: 1, factor: 1 }).then(() => null, error => error);
  assert.equal(closed?.code, 'POOL_CLOSED');
});

test('close is idempotent and stats are immutable snapshots', async () => {
  const pool = createWorkerPool({ workerModule });
  const stats = pool.stats();
  assert.equal(Object.isFrozen(stats), true);
  await pool.close();
  await pool.close();
  assert.equal(pool.stats().closed, true);
});

test('invalid pool configuration fails early', () => {
  assert.equal(DEFAULT_SIZE, 1);
  assert.equal(DEFAULT_MAX_QUEUE, 100);
  assert.equal(DEFAULT_TASK_TIMEOUT_MS, 30_000);
  assert.throws(() => createWorkerPool({ size: 0, workerModule }), { code: 'INVALID_LIMIT' });
  assert.throws(() => createWorkerPool({ workerModule: './missing-worker.js' }), { code: 'INVALID_WORKER_MODULE' });
});
