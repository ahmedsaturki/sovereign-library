# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Atomic File Writer / Safe Replace v0.1**.

## Current repository state

- Last released cube: **Atomic File Writer / Safe Replace v0.1**
- Initial release PR: **#82**, merged as `f6bb8d515eade8ac3bd158b851732070c5a9d470`
- Corrective release PR: **#84**, merged as `4479ae230ccc0ec4ecc1875fcbd16919a80e71bf`
- Initial post-merge Run 620 exposed a real Node 24 compatibility defect: `fsync` was incorrectly imported from `node:fs/promises`.
- Corrective pre-merge verification: **Run 622**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Corrective post-merge verification: **Run 623**, passed on `main` across Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Atomic File Writer / Safe Replace v0.1 is **FROZEN** at corrective release commit `4479ae230ccc0ec4ecc1875fcbd16919a80e71bf`.
- The Node 24 compatibility defect was fixed without changing the public contract; the default `fsync` capability now uses a promisified `node:fs` callback implementation while retaining deterministic injection.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**DIRECTORY-SNAPSHOT-TREE-MANIFEST-V0.1-SPEC**

### Immediate next task

Write and commit the complete SPEC for **Directory Snapshot / Tree Manifest v0.1** before implementation begins.

The SPEC must lock:

1. standalone recursive local directory inventory and public API
2. deterministic traversal and stable entry ordering
3. explicit file, directory, and symlink representation
4. configurable symlink policy without unsafe target traversal
5. bounded depth, entry count, path length, and aggregate manifest size
6. optional content digesting with caller-selected hash capability
7. explicit handling of permission errors, vanished entries, and concurrent mutation
8. deterministic snapshot identity and canonical manifest serialization
9. clear distinction between logical snapshot and filesystem truth at capture time
10. deterministic filesystem, clock, identity, digest, and serialization capability seams
11. Ubuntu, Windows, macOS-15-Intel, and relevant WSL verification
12. zero-runtime-third-party-dependency boundary

No implementation starts before the SPEC exists on the control plane.

## Scope lock

The next cube owns deterministic local directory snapshotting and manifest construction. It does not own file watching, atomic file writes, advisory locking, temporary workspace lifecycle, content synchronization, persistence databases, network storage, or document parsing.

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
