# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Ephemeral Workspace / Scratch Directory v0.1

PR #81 was squash-merged as `33b98771c4702a02dbdc3ce267af516bfbd8e43c`.

Pre-merge **Run 613** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate.

Post-merge **Run 614** initially experienced a transient macOS-15-Intel runner hang/cancellation during contract tests while Ubuntu and Windows completed successfully. The macOS job was re-run independently on the identical release commit and passed syntax checks, full repository tests, and real-browser smoke. No code or workflow changes were required for the rerun.

The release provides atomic unique workspace creation, immutable identity and bounded owner metadata, EWC1 integrity-protected workspace records, exact-owner idempotent cleanup, path/symlink boundary protection, optional TTL without implicit deletion, conservative explicit-token stale recovery, deterministic filesystem/clock/identity seams, and zero runtime third-party dependencies.

The cube is **FROZEN** at `33b98771c4702a02dbdc3ce267af516bfbd8e43c`.

### File Lease / Advisory Lock v0.1

PR #80 was squash-merged as `b3d4f1dc61a6ed64d642fc0a9a92466c01da2868`.

Pre-merge **Run 607** and post-merge **Run 608** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, 522/522 full repository tests, and real-browser smoke.

### Filesystem Watcher / Change Stream v0.1

PR #79 was merged as `239e418e620d06de5d25a9c40905f6efc42334b3`.

Post-merge **Run 598** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.

### Runtime Capability Inspector / Preflight v0.1

PR #78 was squash-merged as `139a7d6c824b7fe522712c65e1b9ffcf605e134f4`.

Pre-merge **Run 580** and post-merge **Run 581** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.

### Previous release chain

Artifact Release Publication Confirmation / Outcome Receipt v0.1 — PR #77 — `ee642ac4f760da6ee6263faa5e82bf7d197fa78d`

Artifact Release Publication Executor / Boundary v0.1 — PR #76 — `23cf7b06e9162201683eb613d6c71c241cb5e34e`

Artifact Release Closure Receipt / Finalization v0.1 — PR #75 — `0e1adc1fc41924c4df14c5b10aa5ed1278297b90`

Earlier released cubes remain pinned to their recorded immutable SHAs.

## Active milestone

### ATOMIC-FILE-WRITER-SAFE-REPLACE-V0.1-SPEC

The Ephemeral Workspace / Scratch Directory release is complete and frozen. The next selected standalone product is:

**Atomic File Writer / Safe Replace v0.1**

Rationale:

- safe replacement is a distinct capability not owned by Filesystem, Storage, Serialization, or Ephemeral Workspace
- it provides a reusable crash-conscious primitive for configuration writes, manifests, generated artifacts, checkpoints, and local application state
- the boundary is narrow: write complete candidate content into the destination directory, validate it, then atomically replace one destination when the platform/filesystem allows
- native filesystem primitives are sufficient for the core without third-party runtime dependencies
- failure behavior can be explicit about cross-device moves, permissions, symlinks, cleanup, and durability limitations

### Immediate next task

Write and commit the complete SPEC at `specs/atomic-file-writer-safe-replace-v0.1.md` before implementation begins.

The SPEC must lock:

- single-file atomic replace contract
- destination-directory temporary creation
- complete candidate write before replacement
- optional digest validation
- permission/mode policy
- crash/failure cleanup semantics
- same-filesystem and cross-device behavior
- symlink/path safety
- deterministic capability seams
- bounded input and cleanup behavior
- Ubuntu, Windows, macOS-15-Intel, and relevant WSL verification
- zero-runtime-third-party-dependency boundary

No unrelated cube implementation starts before the SPEC gate is complete.

## Parked

All other capabilities remain parked until the current cube is released and frozen. New ideas must not bypass the one-current-task rule.
