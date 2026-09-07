# Worker Pool Cube v0.1

A standalone Node.js worker-thread execution pool with bounded concurrency and queueing.

## Contract

- Uses `node:worker_threads` only.
- Each worker loads a trusted application module that exports `execute(payload)`.
- Tasks cross the worker boundary through Node's structured-clone messaging.
- FIFO admission order is preserved.
- Pool size and queue length are bounded.
- Each task has a deterministic timeout.
- Queued cancellation removes work before execution.
- Active cancellation terminates the executing worker and replaces it.
- Worker crashes and timeouts replace the affected worker while the pool remains usable.
- `drain()` stops new admissions and waits for accepted work before closing.
- `close()` is idempotent and rejects remaining work explicitly.
- No `eval`, no dynamic code strings, and no third-party runtime dependencies.

## Scope

This cube provides the execution primitive. Scheduling policy, persistence, distributed coordination, retries, and workflow DAG semantics belong to other cubes.

## Example

```js
import { createWorkerPool } from './src/index.js';

const pool = createWorkerPool({
  size: 4,
  maxQueue: 100,
  workerModule: new URL('./worker.js', import.meta.url),
});

try {
  const result = await pool.submit({ type: 'work', value: 42 });
  console.log(result);
} finally {
  await pool.close();
}
```

The worker module must export an async or synchronous `execute(payload)` function.

## Release boundary

v0.1 intentionally does not provide distributed workers, persistent queues, worker affinity, remote execution, sandboxing, or a general workflow engine.
