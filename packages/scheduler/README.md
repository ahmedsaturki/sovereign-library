# Task Scheduler / Queue Cube v0.1

Standalone in-memory task scheduling with native Node.js runtime primitives only.

## Scope

FIFO with explicit priorities, bounded concurrency, one-shot delay, retries/backoff, cancellation, timeout, queue limits, idempotency, result/error capture, drain/shutdown, and injectable clocks.

No persistence, distribution, cron parsing, workflow DAGs, pub/sub, remote workers, or third-party queue/scheduler packages.

## API

`TaskScheduler` accepts `{ concurrency, maxQueueSize, clock }`.

`submit(fn, options)` accepts:
- `fn(signal)` — sync or async task
- `priority` — finite number; lower means higher priority
- `delayMs` — non-negative safe integer
- `retries` — non-negative safe integer
- `retryBackoff(attempt)` — returns a non-negative safe-integer delay
- `timeoutMs` — positive safe integer per attempt
- `idempotencyKey` — non-empty string
- `signal` — optional AbortSignal

A task handle exposes `id`, live `status`, `promise`, `idempotencyKey`, and `cancel()`.

`drain()` stops accepting new tasks and waits for already accepted work, including delayed and retried work, to become idle.

`shutdown()` stops accepting new work, cancels queued/delayed tasks, aborts running tasks, clears scheduler timers, and returns after scheduler bookkeeping is clean.

## States

`queued`, `delayed`, `running`, `retrying`, `completed`, `failed`, `cancelled`.

Timeout is reported as `TASK_TIMEOUT` and is terminal for the current task when retries are exhausted.

## Errors

`SchedulerCubeError` includes a stable `code` and `retryable` boolean.

Validation codes include `INVALID_CONCURRENCY`, `INVALID_FN`, `INVALID_PRIORITY`, `INVALID_DELAY`, `INVALID_RETRIES`, `INVALID_TIMEOUT`, `INVALID_BACKOFF`, `INVALID_IDEMPOTENCY_KEY`, and `QUEUE_FULL`.

Runtime codes include `TASK_TIMEOUT`, `TASK_ABORTED`, `TASK_CANCELLED`, and `TASK_FAILED`.

## Design notes

The implementation separates the priority queue from delayed scheduling. A binary min-heap provides stable priority/FIFO ordering using a monotonic sequence counter. A second min-heap stores delayed/retry tasks by `runAt`; only one native timer is armed at a time. `FakeClock` enables deterministic delay/retry/timeout tests without wall-clock sleeps.
