# Retry / Resilience Cube v0.1

Standalone deterministic retry runner with native backoff, jitter, budgets, timeouts, and cooperative cancellation.

## Guarantees

- Native ECMAScript only.
- Fixed, linear, and exponential backoff.
- Injectable deterministic randomness for jitter.
- Maximum attempt and total-budget controls.
- Attempt-level timeout with AbortSignal propagation.
- Retryability determined by a caller-supplied classifier.
- Immutable attempt history snapshots.
- Deterministic clock injection.
- No coupling to Logger, HTTP, Scheduler, or any third-party library.

## Example

```js
const policy = createRetryPolicy({
  maxAttempts: 5,
  baseDelayMs: 250,
  backoff: 'exponential',
});

const runner = new RetryRunner(policy);
const result = await runner.run(({signal}) => doWork({signal}));
```

## Scope exclusions

No circuit breaker, distributed state, tracing backend, remote retry store, or adaptive ML retry strategy.
