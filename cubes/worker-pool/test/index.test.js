import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerPool, DEFAULT_MAX_QUEUE, DEFAULT_SIZE, DEFAULT_TASK_TIMEOUT_MS, WorkerPoolError } from '../src/index.js';

const workerModule = new URL('./worker.js', import.meta.url);

test('worker pool executes tasks and returns structured-clone results', async () => {
  const pool = createWorkerPool({ size: 2, workerModule });
  try {
    assert.deepEqual(await pool.submit({ type: 'multiply', value: 7, factor: 6 }), 42);
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
    assert.equal(await first, first !== undefined ? undefined : undefined);
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
    await assert.rejects(() => pool.submit({ type: 'sleep', ms: 10 }), error => error instanceof WorkerPoolError && error.code === 'QUEUE_FULL');
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
    await assert.rejects(queued, error => error instanceof WorkerPoolError && error.code === 'CANCELLED');
    await running;
  } finally {
    await pool.close();
  }
});

test('worker failures are surfaced as task failures without killing the pool', async () => {
  const pool = createWorkerPool({ size: 1, workerModule });
  try {
    await assert.rejects(() => pool.submit({ type: 'fail', message: 'boom', code: 'EXPECTED' }), error => error.name === 'Error' && error.message === 'boom' && error.code === 'EXPECTED');
    assert.equal(await pool.submit({ type: 'multiply', value: 5, factor: 5 }), 25);
  } finally {
    await pool.close();
  }
});

test('task timeout terminates and replaces the worker', async () => {
  const pool = createWorkerPool({ size: 1, workerModule, taskTimeoutMs: 20 });
  try {
    await assert.rejects(() => pool.submit({ type: 'sleep', ms: 100 }), error => error instanceof WorkerPoolError && error.code === 'TASK_TIMEOUT');
    assert.equal(await pool.submit({ type: 'multiply', value: 4, factor: 3 }), 12);
  } finally {
    await pool.close();
  }
});

test('drain stops new submissions and waits for active work', async () => {
  const pool = createWorkerPool({ size: 1, workerModule });
  const task = pool.submit({ type: 'sleep', ms: 25 });
  await pool.drain();
  await task;
  await assert.rejects(() => pool.submit({ type: 'multiply', value: 1, factor: 1 }), error => error instanceof WorkerPoolError && error.code === 'POOL_CLOSED');
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
  assert.throws(() => createWorkerPool({ size: 0, workerModule }), error => error instanceof WorkerPoolError && error.code === 'INVALID_LIMIT');
  assert.throws(() => createWorkerPool({ workerModule: './missing-worker.js' }), error => error instanceof WorkerPoolError && error.code === 'INVALID_WORKER_MODULE' || error.code === 'WORKER_BOOT_FAILED');
});
