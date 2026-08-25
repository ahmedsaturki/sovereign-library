# Directory Snapshot / Tree Manifest v0.1

## Goal

Provide a standalone, deterministic local filesystem inventory primitive that captures a directory tree as an immutable manifest without claiming transactional consistency over a concurrently changing filesystem.

The cube enumerates entries, records explicit entry types and bounded metadata, optionally computes caller-selected content digests, and emits a canonical manifest suitable for audit, indexing, comparison, build inputs, reproducibility, and agent workspace inspection.

## Public contract

Primary operation:

```js
snapshotDirectory(rootPath, options)
```

The result is an immutable snapshot containing:

- format/version
- canonical resolved root identity
- capture timestamp supplied by the configured clock capability
- deterministic snapshot identity
- ordered entries
- capture warnings/errors that were explicitly configured to be non-fatal

Each entry must explicitly identify one of:

- `file`
- `directory`
- `symlink`

Metadata may include bounded size and platform-available mode/timestamps. Platform-specific metadata must never destabilize canonical ordering or serialization.

## Determinism

1. traversal order is deterministic and independent of native directory enumeration order
2. path keys are canonical relative paths using `/` separators in the manifest representation
3. entries are ordered lexicographically by canonical relative path, with type used only as a deterministic tie-breaker when required
4. snapshot identity is derived from canonical manifest serialization and does not consult hidden global state
5. no random values are introduced unless supplied by an explicit identity capability
6. timestamps are read only through the injected clock capability; the cube never calls the wall clock implicitly for identity

## Symlink policy

Default policy is `record-only`: record the symlink as a symlink entry and do not traverse its target.

Supported policies:

- `record-only` — safest default; never follows the symlink target
- `reject` — encountering a symlink is a terminal policy error
- `follow-contained` — follows a symlink only when the resolved target remains inside the canonical root; escape attempts fail closed

The cube must inspect link identity before traversal and must never follow an attacker-controlled link merely because it appears inside the root tree.

## Content digesting

Optional file digesting is enabled explicitly. The caller supplies:

- digest algorithm identifier
- digest implementation capability
- per-file and aggregate byte bounds

The default configuration performs no content reads beyond metadata needed for enumeration.

When enabled, a file that disappears, changes size during hashing, or becomes unreadable is represented according to the configured mutation policy; the cube must not silently substitute a digest from stale or partial content.

## Concurrent mutation semantics

A directory snapshot is a point-in-time best-effort capture, not a filesystem transaction.

Supported mutation policies:

- `fail-fast` — any meaningful mutation or vanished entry aborts the snapshot
- `record-warning` — keep the best-effort entry state and append a bounded warning record
- `skip-vanished` — entries that disappear before capture are omitted and recorded in bounded diagnostics

The snapshot must distinguish capture observations from authoritative filesystem truth. It must never claim that the resulting manifest was atomically captured.

## Error model

Typed failures include at least:

- invalid root
- inaccessible root
- invalid options
- unsupported entry type
- symlink policy violation
- path containment violation
- permission denied
- vanished entry
- concurrent mutation
- digest failure
- digest mismatch
- entry count limit exceeded
- depth limit exceeded
- path length limit exceeded
- manifest size limit exceeded
- serialization failure
- capability validation failure
- circular/accessor/unsupported input

Errors must fail closed and preserve previously existing filesystem state. The cube performs no writes to the scanned tree.

## Bounds

The implementation must enforce finite limits for:

- maximum recursion depth
- maximum entry count
- maximum canonical path length
- maximum aggregate manifest bytes
- maximum warning count
- maximum warning/detail length
- maximum file bytes hashed per snapshot

The defaults must be conservative enough for agent or automation use, with explicit caller overrides subject to hard upper ceilings.

## Capability seams

Deterministic tests and alternate environments must be possible through injected capabilities for:

- filesystem metadata and directory enumeration
- symlink resolution
- clock
- identity generation
- digest implementation
- canonical serialization

Capability objects are execution boundaries and must not be frozen or recursively treated as plain caller data.

## Immutability and serialization

Returned snapshots are deeply immutable.

Canonical serialization must:

- use stable object-key ordering
- use stable entry ordering
- normalize path separators in the manifest representation
- reject unsupported non-finite values
- produce the same bytes for semantically identical snapshots

Snapshot identity must be reproducible from canonical serialization.

## Cross-platform contract

Target verification:

- Ubuntu
- Windows
- macOS-15-Intel
- relevant WSL environments

Path comparison must respect platform case sensitivity semantics without corrupting the canonical manifest representation. Windows drive roots, UNC paths, and separator differences must not create duplicate logical entries.

## Standalone boundary

Allowed runtime foundations:

- Node.js standard library
- native filesystem primitives

No third-party runtime package is required.

The cube does not depend on:

- filesystem watcher
- atomic file writer
- file lease
- ephemeral workspace
- content-addressed storage
- database
- network service
- external index

Those systems may consume a produced manifest through explicit data interchange, but the snapshot cube remains independently usable.

## Side-effect boundary

The core is read-only with respect to the scanned tree. It must not create, mutate, rename, delete, or rewrite files inside the target root.

Temporary state required for hashing or testing must be outside the scanned root and owned by the caller/test harness.

## Definition of done

- SPEC committed before implementation
- public API documented
- standalone implementation with zero runtime third-party dependencies
- deterministic traversal and canonical serialization
- normal-path tests
- failure/recovery tests
- symlink containment tests
- concurrent mutation tests
- bounds tests
- digest tests
- accessor/circular/unsupported input tests
- runnable example
- README + CHANGELOG
- package registration
- clean-checkout verification
- Ubuntu + Windows + macOS-15-Intel CI
- real-browser smoke gate remains green for repository verification

Release sequence:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`
