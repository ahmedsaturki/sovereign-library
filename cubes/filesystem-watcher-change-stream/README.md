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

Event types are `created`, `changed`, `removed`, and `renamed`. Renames are emitted only when the source explicitly supplies an old/new pair. Native adapters do not fabricate renames.

## Safety model

The cube is read-only with respect to watched targets. It does not execute processes, perform network access, copy files, or persist configuration. Roots and event paths are bounded and normalized so events cannot escape the configured root boundary.

The queue is finite. Overflow behavior must be explicit: `reject_new`, `drop_oldest`, or `drop_newest`.

## Deterministic testing

Pass an `AsyncIterable` as `source` to test normalization, overflow, lifecycle, and recovery without depending on operating-system timing.

## Native behavior

The core uses Node.js `fs.watch` and standard-library path handling. Recursive watching follows platform support; platform differences are documented rather than hidden behind fabricated events.

## Dependency status

Zero runtime third-party dependencies. Target platforms are Ubuntu, Windows, macOS-15-Intel, and WSL where the underlying filesystem notification capability is supported.
