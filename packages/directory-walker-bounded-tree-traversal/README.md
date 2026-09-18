# Directory Walker / Bounded Tree Traversal v0.1

Standalone, dependency-free directory traversal with deterministic ordering, hard resource budgets, explicit symlink policy, visitor backpressure, cancellation, and failure/recovery semantics.

## API

```js
import { walk } from './src/index.js';

const entries = await walk('/workspace', {
  maxDepth: 32,
  maxEntries: 10_000,
  symlinkPolicy: 'report',
});
```

Visitor mode keeps memory bounded by not collecting the tree:

```js
await walk('/workspace', {
  mode: 'visitor',
  onEntry: async (entry) => consume(entry),
});
```

## Policies

`symlinkPolicy` supports `reject`, `report`, and `follow-contained`. The default is `report` and never traverses a symlink.

`follow-contained` uses the released Safe Path Resolver boundary and fails closed on root escapes and cycles.

## Safety budgets

Supported bounds include maximum depth, entries, path/name lengths, directory entries, visited directories, symlink depth, work units, and an optional deadline.

Visitor mode is sequential and therefore provides explicit backpressure without an unbounded promise queue.

## Results

Collected mode returns an immutable ordered array of entries with normalized `/`-separated relative paths.

Visitor mode returns a frozen summary containing delivered entry count and work units.

`partial: 'return'` returns an immutable partial result and terminal error metadata instead of throwing.

## Guarantees

- deterministic traversal order independent of filesystem enumeration order
- no shell expansion or command execution
- no filesystem mutation
- zero runtime third-party dependencies
- executable capability seams are isolated from plain-data validation
- cross-platform path reporting

See the repository SPEC for the complete v0.1 contract.
