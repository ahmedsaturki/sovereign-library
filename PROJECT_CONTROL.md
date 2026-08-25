# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Ephemeral Workspace / Scratch Directory v0.1**.

## Current repository state

- Last released cube: **Ephemeral Workspace / Scratch Directory v0.1**
- Release PR: **#81**, merged
- Release commit: `33b98771c4702a02dbdc3ce267af516bfbd8e43c`
- Pre-merge verification: **Run 613**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 614**, initially hit a transient macOS-15-Intel runner hang/cancellation during contract tests; Ubuntu and Windows passed. The macOS job was re-run independently on the same release commit and then passed syntax, full repository tests, and real-browser smoke. The rerun establishes the release state as verified across the supported matrix.
- Ephemeral Workspace / Scratch Directory v0.1 is **FROZEN**.
- The previous macOS interruption was a runner/infrastructure anomaly, not a product regression: the identical commit passed pre-merge on macOS and passed the clean macOS rerun without code changes.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ATOMIC-FILE-WRITER-SAFE-REPLACE-V0.1-SPEC**

### Immediate next task

Write and commit the complete SPEC for **Atomic File Writer / Safe Replace v0.1** before implementation begins.

The SPEC must lock:

1. atomic replacement semantics for one destination file
2. temporary-file creation inside the destination directory
3. complete-write verification before replacement
4. optional content digest and deterministic metadata
5. preservation or explicit control of destination mode/permissions where supported
6. crash/failure cleanup without deleting an unrelated pre-existing destination
7. same-filesystem replacement guarantees and cross-device failure behavior
8. symlink/path containment policy and refusal to follow unsafe destination indirection
9. bounded input size, metadata, temporary names, and cleanup attempts
10. deterministic filesystem, clock, identity, and rename capability seams
11. Ubuntu, Windows, macOS-15-Intel, and relevant WSL verification
12. zero-runtime-third-party-dependency boundary

No implementation starts before the SPEC exists on the control plane.

## Scope lock

The next cube owns safe replacement of one local file from caller-supplied bytes or an explicit stream writer. It does not own general file synchronization, filesystem watching, directory trees, advisory locking, process execution, content parsing, cloud/object storage, or databases.

## Definition of done

A milestone is DONE only when implementation, public API documentation, normal and failure-path tests, recovery behavior, examples, reproducible release state, cross-platform gates, and roadmap/control updates all pass.

## Anti-loop rules

- Do not redesign the whole architecture during a cube release.
- Do not add a dependency to solve a local problem without recording the decision.
- Do not start a second cube because the current cube is difficult.
- Do not expand scope because a competitor has more features.
- Do not call a cube production-ready from source inspection alone.
- Park out-of-scope work and continue.

## Lessons-learned rule

Every blocking bug or CI failure must produce root-cause identification, minimal fix, regression coverage, and a control/documentation update when the lesson affects future work.

## Clean-repository rule

`main` is the product branch. Temporary branches and PRs must not become runtime artifacts. Release merges should keep a clean, single-purpose history.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart from memory.

## Release sequence

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

No step may be skipped.
