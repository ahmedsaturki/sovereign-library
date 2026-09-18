# Diff / Patch Cube v0.1

Standalone deterministic structural diff and patch engine for JSON-safe values.

## API

```js
import { applyPatch, createDiffEngine, diff } from './src/index.js';

const operations = diff({ a: 1 }, { a: 2, b: true });
const result = applyPatch({ a: 1 }, operations);

console.log(result); // { a: 2, b: true }

const engine = createDiffEngine({ maxOperations: 1000 });
console.log(engine.diff({ users: [] }, { users: [{ id: 1 }] }));
```

The cube supports only JSON-safe primitives, arrays, and plain objects. It uses strict JSON Pointer paths, deterministic operation ordering, bounded traversal/work, immutable outputs, and typed fail-closed errors.

It intentionally does not implement filesystem patches, text diffs, three-way merge, binary formats, network synchronization, or external services.
