# Application Lifecycle / Graceful Shutdown Coordinator v0.1

Coordinates the shutdown of multiple independently owned resources under one deterministic deadline.

## Example

```js
import { createApplicationLifecycle } from './src/index.js';

const lifecycle = createApplicationLifecycle({
  globalShutdownTimeoutMs: 10_000,
});

lifecycle.register(
  { id: 'http', priority: 100 },
  { close: () => httpServer.close() },
);

lifecycle.register(
  { id: 'workers', priority: 50, timeoutMs: 3_000 },
  { close: () => workerPool.close() },
);

await lifecycle.start();
const result = await lifecycle.shutdown();
console.log(result.state, result.successCount, result.failedCount);
```

The coordinator owns ordering and deadlines only. Each participant remains responsible for its own close/drain behavior.

## Guarantees

- Deterministic participant order.
- One shutdown transaction per coordinator.
- Concurrent callers share the same transaction.
- Global deadline clamps participant work.
- Participant failures remain visible and bounded.
- Late completions cannot mutate a later transaction.
- Snapshots are immutable.
- Runtime has zero third-party dependencies.
