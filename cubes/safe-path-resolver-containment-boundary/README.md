# Safe Path Resolver / Containment Boundary v0.1

Standalone, dependency-free path resolution and containment utilities for cross-platform applications and security-sensitive boundaries.

## Core guarantees

- lexical mode is pure and filesystem-free
- explicit root/base anchoring
- segment-aware containment
- traversal rejection
- drive, UNC, and Windows namespace root handling
- explicit case policy
- narrow filesystem capability seams
- explicit symlink policies
- bounded inputs and typed failures
- deterministic SPR1 serialization

## Example

```js
import { resolveContained, isContained } from './src/index.js';

const safe = resolveContained('/srv/app', 'assets/logo.svg');
console.log(safe); // /srv/app/assets/logo.svg

console.log(isContained('/srv/application/a', '/srv/app').status); // outside
```

No filesystem access occurs in the pure APIs.
