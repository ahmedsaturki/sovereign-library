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
- deterministic SPR1 serialization with SHA-256 integrity verification
- follow-contained mode requires an explicit bounded `symlinkDepth(path)` capability

## Example

```js
import { resolveContained, isContained } from './src/index.js';

const safe = resolveContained('/srv/app', 'assets/logo.svg');
console.log(safe); // /srv/app/assets/logo.svg

console.log(isContained('/srv/application/a', '/srv/app').status); // outside
```

No filesystem access occurs in the pure APIs.

## Filesystem-aware example

```js
import { canonicalizePath } from './src/index.js';

const capabilities = {
  realpath: async path => path,
  symlinkDepth: async () => 0,
  lstat: async () => ({ isSymbolicLink: false }),
};

const result = await canonicalizePath('/srv/app/file.txt', '/srv/app', capabilities, {
  symlinkPolicy: 'follow-contained',
  maxSymlinkDepth: 8,
});
```

`follow-contained` fails closed when `symlinkDepth` is unavailable or the resolved hop count exceeds the configured limit.

## SPR1 integrity

Serialized reports carry an SHA-256 digest over `SPR1|1|<canonical-payload>`. Parsing rejects missing, malformed, or tampered integrity data with `INTEGRITY_FAILURE`.

No runtime third-party dependencies are required.
