# Canonical JSON / Normalization Cube v0.1

Standalone deterministic canonicalization for JSON-safe values.

```js
import { canonicalStringify, normalize } from './src/index.js';

const value = { z: 1, nested: { b: true, a: 'x' }, n: -0 };
const normalized = normalize(value);
const canonical = canonicalStringify(value);

console.log(normalized);
console.log(canonical);
```

The cube sorts plain-object keys deterministically, preserves array order and negative zero, rejects unsupported values and circular references, bounds traversal and serialized size, never mutates source input, and returns deeply immutable normalized output.

No runtime third-party dependencies are required.

Out of scope: signing, hashing, schema validation, semantic domain normalization, binary formats, and network services.
