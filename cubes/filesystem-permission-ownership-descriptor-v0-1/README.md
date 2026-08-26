# Filesystem Permission / Ownership Descriptor v0.1

Standalone, dependency-free normalization and inspection of filesystem permission/ownership metadata.

## Guarantees

- Read-only by default.
- POSIX mode bits are reported only when supported evidence exists.
- Windows readonly semantics are reported separately from POSIX mode bits.
- Owner/group identifiers are preserved only when supplied by the capability; names are redacted by default.
- Raw owner/group names require explicit opt-in and can be SHA-256 hashed by policy.
- No path traversal, chmod, chown, ACL mutation, or ownership mutation is performed.
- `inspectPath()` requires an explicit `lstat` capability; the core does not access the filesystem by itself.
- PPO1 serialization is deterministic, bounded, integrity-protected, and immutable on parse.

## Example

```js
import { inspectPath, createNodeCapabilities, serializeDescriptor } from './src/index.js';
import { lstat } from 'node:fs/promises';

const descriptor = await inspectPath('/tmp/example.txt', createNodeCapabilities({ lstat }));
console.log(serializeDescriptor(descriptor));
```

## Privacy

Names are omitted by default. With `{ includeOwnerName: true, includeGroupName: true }`, names are SHA-256 redacted by default. Pass `ownerRedaction: 'none'` only when explicit raw-name disclosure is desired.

## Platform semantics

The cube never fabricates POSIX ownership/mode values on platforms where they are unavailable. Capability flags communicate what the observed metadata can support.
