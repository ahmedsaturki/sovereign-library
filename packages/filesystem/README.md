# Filesystem Cube v0.1

Standalone filesystem capability built only on Node.js standard-library `fs/promises` and `path` primitives.

## Public API

- `resolve`
- `exists`
- `stat`
- `readBytes` / `readText`
- `writeBytes` / `writeText`
- `appendBytes` / `appendText`
- `atomicWriteBytes` / `atomicWriteText`
- `list`
- `mkdir`
- `remove`
- `copy`
- `move`
- `FilesystemCubeError`

## Guarantees

- Runtime third-party dependencies: **0**.
- Explicit root containment when `root` is configured.
- Deterministic typed errors.
- Configurable read/write byte limits.
- Temporary-file replacement for atomic-write semantics.
- Cross-platform behavior is tested through GitHub Actions on Windows, Linux, and macOS.
- No implicit network, database, cloud-storage SDK, watcher, or framework behavior.

### Atomic replacement note

On POSIX systems, rename-based replacement provides the expected atomic replacement primitive. On Windows, replacing an existing target can require a remove-then-rename fallback because overwrite semantics differ; that fallback is intentionally implemented and tested rather than hidden behind an unsupported promise of identical filesystem guarantees.

## v0.1 boundaries

Out of scope: file watching, virtual filesystem drivers, cloud-storage SDKs, databases, sync daemons, and framework integrations.
