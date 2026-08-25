# Rate Limiter / Backpressure Cube v0.1

Standalone native token-bucket rate limiter with bounded async backpressure.

## Guarantees

- Native ECMAScript only.
- Deterministic clock injection.
- Configurable burst capacity and refill rate.
- Immediate `tryAcquire()` admission.
- Bounded FIFO waiting queue.
- `AbortSignal` cancellation for queued waiters.
- Explicit queue-overflow failure.
- Deterministic retry-after / wait duration.
- Immutable statistics snapshots.
- Explicit `clear()` and `close()` cleanup.

## API

```js
const limiter = new RateLimiter({
  capacity: 5,
  refillPerSecond: 2,
  maxQueue: 100,
});

const decision = limiter.tryAcquire();

await limiter.acquire({signal});
const stats = limiter.getStats();
```

`tryAcquire()` never waits. `acquire()` queues only when capacity is temporarily unavailable and the bounded queue has space.

## Scope exclusions

No Redis, distributed coordination, middleware framework, remote state, adaptive throttling, or third-party limiter dependency.
