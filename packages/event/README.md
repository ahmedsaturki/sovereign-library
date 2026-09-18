# Event / Signal Cube v0.1

Standalone in-process event and signal primitives using Node.js runtime primitives only.

## Guarantees

- deterministic listener registration order
- explicit subscribe/unsubscribe
- `once` listeners
- AbortSignal-driven subscription cancellation
- bounded listener counts
- listener error isolation: all listeners are given their turn; errors are reported after dispatch
- stable listener snapshots for safe re-entrancy
- sequential `emitAsync` dispatch
- `waitFor()` with optional filter, timeout, and cancellation
- idempotent `close()` cleanup

## API

```js
import { EventBus } from './src/index.js';

const bus = new EventBus({ maxListeners: 100 });
const off = bus.on('property.updated', payload => {
  console.log(payload.id);
});

bus.once('property.updated', payload => console.log('first only', payload));
bus.emit('property.updated', { id: 'p-1' });
off();
bus.close();
```

`emit()` is synchronous. `emitAsync()` invokes listeners sequentially and awaits each listener before continuing. `waitFor()` returns a Promise and can be constrained by a filter, timeout, or AbortSignal.

## Out of scope

This cube does not provide network transport, distributed pub/sub, persistence, broker semantics, durable logs, or a workflow engine.
