# Filesystem Permission / Ownership Descriptor v0.1

Standalone, dependency-free normalization and inspection of filesystem permission/ownership metadata.

## Guarantees

- Read-only by default; v0.1 contains no mutation API.
- POSIX mode bits are reported only from explicit evidence.
- `readable`, `writable`, and `executable` are tri-state (`true`, `false`, `unknown`).
- Windows readonly semantics are reported separately; POSIX mode bits are never fabricated.
- Owner/group identities are `known`, `redacted`, or `unknown`; raw IDs and names require explicit bounded opt-in.
- Names are SHA-256 redacted by default when explicitly requested; raw names require `ownerRedaction: 'none'`.
- ACL availability is explicit: `available`, `unsupported`, `unavailable`, or `not-requested`.
- Platform flags are deterministic, deduplicated, sorted, and bounded.
- `inspectPath()` requires an explicit `lstat` capability and supports injected platform, clock, hash, root-resolution, containment, and cancellation seams.
- Relative paths fail closed unless an explicit root-resolution capability is supplied.
- No chmod, chown, ACL mutation, ownership mutation, or independent `startsWith` containment check is performed.
- PPO1 serialization is canonical, bounded, SHA-256 integrity-protected, and immutable on parse.
- No runtime third-party dependencies.

## Example

```js
import { inspectPath, createNodeCapabilities, serializeDescriptor } from './src/index.js';
import { lstat } from 'node:fs/promises';

const capabilities = createNodeCapabilities({
  lstat,
  platform: () => process.platform,
  clock: () => new Date().toISOString(),
});

const descriptor = await inspectPath('/tmp/example.txt', capabilities);
console.log(serializeDescriptor(descriptor));
```

## Privacy

By default, owner/group IDs and names are not emitted. Explicit name inclusion produces a bounded SHA-256 representation unless `ownerRedaction: 'none'` is explicitly selected. Diagnostics and typed errors do not copy native filesystem error messages.

## Platform semantics

Windows, Linux, macOS, and WSL are represented separately. WSL is reported only when the injected capability or observed metadata identifies it; the cube does not infer Windows backing from Linux execution. Other platforms/filesystems return explicit `other`/`unsupported` states rather than fabricated ownership or permission data.

## Failure and recovery

Inspection is side-effect free. Invalid inputs, accessor-backed inputs, malformed capability results, platform mismatches, containment failures, unsupported states, bounds violations, and cancellation use deterministic typed error codes. Cancellation occurs before/after the filesystem seam and leaves no persistent state.
