# Concurrency / Bulkhead Cube v0.1

Native ECMAScript concurrency control for Sovereign Library.

## Guarantees

- bounded active leases with a configurable limit
- immediate `tryAcquire()` admission checks
- bounded FIFO waiting with explicit queue overflow
- AbortSignal cancellation for queued requests
- lease release lifecycle with double-release protection
- deterministic shutdown/close behavior
- immutable statistics snapshots
- no runtime third-party dependencies

## Example

```js
import { Bulkhead } from './src/index.js';

const bulkhead = new Bulkhead({ limit: 4, maxQueue: 16 });
const lease = await bulkhead.acquire();

try {
  await doWork();
} finally {
  lease.release();
}
```

This cube controls concurrency admission only. It does not execute work, retry failures, apply priorities, or coordinate across processes.
