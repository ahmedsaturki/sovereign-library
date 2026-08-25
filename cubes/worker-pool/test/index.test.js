    assert.equal(await pool.submit({ type: 'multiply', value: 5, factor: 5 }), 25);
  } finally {
    await pool.close();
  }
});

test('real worker crashes are surfaced and the worker is replaced', async () => {
  const pool = createWorkerPool({ size: 1, workerModule });
  try {
    const crashedTask = pool.submit({ type: 'crash', code: 17 });
    crashedTask.catch(() => {});
    const failure = await crashedTask.then(() => null, error => error);
    assert.ok(failure instanceof WorkerPoolError);
    assert.ok(['WORKER_FAILED', 'WORKER_EXITED'].includes(failure.code));
    assert.equal(await pool.submit({ type: 'multiply', value: 6, factor: 7 }), 42);
  } finally {
    await pool.close();
  }
});

test('task timeout terminates and replaces the worker', async () => {
  const pool = createWorkerPool({ size: 1, workerModule, taskTimeoutMs: 50 });
  try {
    const timeoutTask = pool.submit({ type: 'sleep', ms: 250 });
    timeoutTask.catch(() => {});
    const timeoutError = await timeoutTask.then(() => null, error => error);
    assert.equal(timeoutError?.code, 'TASK_TIMEOUT');
    assert.equal(timeoutError?.statusCode, 408);

    const recoveryDeadline = Date.now() + 1000;
    let recovered = false;
    while (Date.now() < recoveryDeadline) {
      try {
        assert.equal(await pool.submit({ type: 'multiply', value: 4, factor: 3 }), 12);
        recovered = true;
        break;
      } catch (error) {
        assert.ok(error instanceof WorkerPoolError);
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    assert.equal(recovered, true);
  } finally {
    await pool.close();
  }
});

test('drain stops new submissions and waits for active work', async () => {
  const pool = createWorkerPool({ size: 1, workerModule });
  const task = pool.submit({ type: 'sleep', ms: 25, value: 1 });
  await pool.drain();
  assert.deepEqual(await task, { type: 'sleep', ms: 25, value: 1 });
  const closedTask = pool.submit({ type: 'multiply', value: 1, factor: 1 });
  closedTask.catch(() => {});
  const closed = await closedTask.then(() => null, error => error);
  assert.equal(closed?.code, 'POOL_CLOSED');
});

test('close is idempotent and stats are immutable snapshots', async () => {