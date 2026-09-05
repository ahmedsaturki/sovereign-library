# Filesystem Watcher / Change Stream v0.1

Standalone read-only filesystem change observation with a bounded event queue and deterministic injected-source testing.

## API

```js
import { createWatcher } from './src/index.js';

const watcher = createWatcher({
  roots: ['/workspace/project'],
  recursive: true,
  queueCapacity: 256,
  overflow: 'reject_new',
});

await watcher.start();

for (;;) {
  const item = await watcher.next();
  if (item.done) break;
  console.log(item.value);
}

await watcher.close();
```

Event types are `created`, `changed`, `removed`, and `renamed`. Renames are emitted only when the source explicitly supplies an old/new pair. Native adapters do not fabricate renames from unrelated create/remove notifications.

## Safety model

The cube is read-only with respect to watched targets. It does not execute processes, perform network access, copy files, or persist configuration. Roots and event paths are bounded and normalized so events cannot escape the configured root boundary.

The queue is finite. Overflow behavior must be explicit: `reject_new`, `drop_oldest`, or `drop_newest`. Overflow is observable through the immutable `stats()` snapshot.

## Lifecycle and debounce

`start()` is idempotent while running. `close()` is idempotent and releases owned native watcher handles and timers. `next()` drains queued events before returning its terminal `done` state. With debounce enabled, source completion does not cause premature `done`: pending debounced events are always delivered first.

Debounce is opt-in and bounded to 60 seconds. It coalesces repeated events for the same root/path within the configured window; the implementation never fabricates stronger evidence than the source provided.

## Deterministic testing

Pass an `AsyncIterable` as `source` to test normalization, overflow, lifecycle, debounce, and recovery without depending on operating-system timing. The injected source is treated as an execution capability and is never frozen or traversed as configuration data.

## Native behavior

The core uses Node.js `fs.watch` and standard-library path handling. Recursive watching follows native platform support. On Windows, native watcher registration canonicalizes the watched root with `realpathSync.native()` when available; this avoids the Windows short/long-path mismatch that can otherwise surface inside the Node/libuv watcher boundary.

Platform differences are documented rather than hidden behind fabricated events. The native adapter may emit `created`, `changed`, and `removed` primitives but does not synthesize `renamed` pairs unless an explicit source supplies both paths.

## Dependency status

Zero runtime third-party dependencies. Target platforms are Ubuntu, Windows, macOS-15-Intel, and WSL where the underlying filesystem notification capability is supported.
