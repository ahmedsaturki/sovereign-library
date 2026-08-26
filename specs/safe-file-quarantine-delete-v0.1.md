# Safe File Quarantine / Delete v0.1 — Specification

## Status

SPEC-FROZEN on the active feature branch. Implementation may proceed only from this contract.

## Product goal

Provide a standalone, dependency-free local filesystem primitive for **safe quarantine, restore, and irreversible purge** of files and directories. The default destructive boundary is quarantine: an item is moved into a caller-declared quarantine root before any permanent deletion is allowed.

## Non-goals

This cube does not provide a general recycle-bin UI, cloud backup, distributed locking, encryption, filesystem snapshotting, forensic recovery, privilege escalation, or cross-device atomicity claims.

## Public operations

- `quarantineItem(path, options, capabilities)` moves one filesystem item into an explicit quarantine root and returns an immutable receipt.
- `restoreQuarantined(receipt, options, capabilities)` restores an exact quarantined item to its original approved path.
- `purgeQuarantined(receipt, options, capabilities)` permanently removes only the exact quarantined item represented by a validated receipt.

## Safety contract

1. Mutation is explicit and capability-gated.
2. Source symlinks are rejected by default and are never followed implicitly.
3. Relative source paths require an explicit root/containment capability; independent string-prefix containment is forbidden.
4. The quarantine root must be explicit and must not be inside the source item being quarantined.
5. Each quarantine operation creates a unique quarantine directory before moving the payload, so a destination collision cannot overwrite an unrelated item.
6. Native rename is used for the payload move; cross-device copy/delete fallback is forbidden.
7. A manifest is written only after the payload move succeeds. Manifest failure triggers best-effort rollback of the payload to its original path.
8. Permanent deletion is only available from quarantine and requires a validated receipt bound to the exact quarantine identity.
9. Restore never overwrites an existing destination; a collision fails closed.
10. Caller inputs and returned receipts are immutable snapshots.

## Receipt

A receipt must contain bounded, deterministic fields:

- `format`: `SFQ1`
- `token`: opaque bounded quarantine identity
- `sourcePath`: approved normalized source identity
- `quarantineRoot`: approved quarantine root
- `quarantinePath`: exact quarantine directory
- `payloadPath`: exact payload path within quarantine directory
- `kind`: `file` or `directory`
- `createdAt`: injected clock value when available
- `status`: `quarantined`, `restored`, or `purged`
- `sourceObservation`: coarse immutable metadata captured before mutation

No raw native error messages, owner/group identity, file contents, or environment-derived identifiers may appear in default diagnostics.

## Manifest and integrity

The quarantine directory contains a canonical JSON manifest describing the exact receipt identity. The manifest must include an integrity digest over its canonical payload. Malformed, tampered, mismatched, duplicate, accessor-backed, circular, or oversized manifest input fails closed.

## Bounds

The implementation must bound:

- source, root, receipt, manifest, token, and reason lengths
- directory entry/depth work needed for metadata validation
- number of recovery attempts
- serialized receipt/manifest bytes

## Capability seams

All filesystem and platform effects are injectable callable capabilities:

- `lstat`
- `stat` when available
- `realpath` when needed for containment
- `mkdir`
- `rename`
- `readFile`
- `writeFile`
- `rm`
- `now`
- `token`/identity generator
- Safe Path Resolver containment helper

Executable capabilities must remain separate from plain data. Accessor-backed capability/configuration objects are rejected before getter execution.

## Failure semantics

Typed deterministic failures are required for:

- invalid input
- accessor input
- circular input
- unsupported capability
- malformed capability result
- source not found
- permission denied
- source symlink rejected
- root escape / containment violation
- quarantine destination collision
- cross-device rename/unsupported atomic move
- manifest corruption or mismatch
- destination collision during restore
- malformed/tampered receipt
- bounded-size/work violations
- rollback failure
- purge/restore cleanup failure

A secondary cleanup or rollback failure must never erase the primary failure identity.

## Recovery

- Quarantine move succeeds only when a receipt can be produced or the payload is successfully rolled back.
- Restore failure leaves the quarantine payload intact.
- Purge failure leaves the quarantine payload intact whenever the platform permits.
- Recovery attempts are bounded and their outcome is exposed explicitly.
- Reusing a stale/foreign receipt against another quarantine item must fail closed.

## Cross-platform behavior

- Linux/macOS: use native rename semantics; do not claim crash durability.
- Windows: reject destination collisions and symlink/reparse-point ambiguity conservatively; do not fabricate POSIX semantics.
- WSL: report observed filesystem capability behavior rather than inferring backing-store semantics.
- Cross-device moves: fail closed instead of copying.

## Required tests

- file and directory quarantine
- source symlink rejection
- root containment and quarantine-root separation
- destination collision protection
- cross-device/unsupported rename failure
- manifest creation and tamper detection
- rollback after manifest-write failure
- exact restore collision behavior
- restore recovery after failure
- purge requires exact validated receipt
- repeated purge/restore behavior
- accessor/circular/malformed input rejection
- bounded receipt/manifest sizes
- immutable receipts
- Linux, Windows, and macOS CI; WSL-compatible capability behavior where available

## Release gate

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE`

The release is complete only when standalone documentation, examples, tests, recovery hardening, cross-platform verification, and zero runtime third-party dependency requirements all pass.
