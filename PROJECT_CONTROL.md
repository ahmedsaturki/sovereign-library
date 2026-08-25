# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **File Lease / Advisory Lock v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Filesystem Watcher / Change Stream v0.1**
- Release PR: **#79**, merged
- Release commit: `239e418e620d06de5d25a9c40905f6efc42334b3`
- Post-merge verification: **Run 598**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Filesystem Watcher / Change Stream v0.1 is **FROZEN**.
- Next cube SPEC is committed on branch `file-lease-advisory-lock-v0-1` at `specs/file-lease-advisory-lock-v0.1.md`.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**FILE-LEASE-ADVISORY-LOCK-V0.1-SPEC**

### Immediate next task

Implement the public contract defined in `specs/file-lease-advisory-lock-v0.1.md`:

1. establish atomic advisory ownership without unsafe read-then-write races
2. implement deterministic acquisition, busy, release, and recovery outcomes
3. provide explicit lease identity and bounded owner metadata
4. support opt-in TTL and safe renewal semantics
5. implement conservative stale recovery without timestamp-only ownership claims
6. protect release from deleting a successor owner's lock
7. implement versioned integrity-protected lock records
8. enforce path, metadata, and record-size bounds and fail-closed input validation
9. verify Ubuntu, Windows, macOS-15-Intel, and relevant WSL filesystem boundaries
10. remain zero-runtime-third-party-dependency and fully documented/tested

## Scope lock

Allowed scope for File Lease / Advisory Lock v0.1:

- cooperative advisory lease acquisition for filesystem paths
- atomic lock ownership establishment using native filesystem primitives
- immutable bounded lease identity and metadata
- optional TTL and renewal
- conservative opt-in stale recovery
- exact-owner release and ownership-loss protection
- deterministic test seams and cross-platform verification

Explicitly out of scope:

- mandatory locking against non-cooperating software
- modification of protected file contents
- process execution
- network/distributed locking
- database/cloud coordination
- GUI/admin console
- process termination
- cluster-wide consensus

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
