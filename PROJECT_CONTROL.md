# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Lifecycle / Retention Index Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Dependency Graph / Relationship Index v0.1**
- Release PR: **#64**, squash-merged
- Release commit: `2616a058f90ae1469561dc508eaea812e43e0f99`
- Pre-merge verification: **Run 471**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 472**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Dependency Graph / Relationship Index v0.1 is therefore **FROZEN**.
- The release provides deterministic node/edge identity, bounded adjacency and path queries, cycle detection, atomic mutations, checksum-protected persistence, immutable snapshots, typed fail-closed errors, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-LIFECYCLE-RETENTION-INDEX-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic local artifact lifecycle/retention index:

1. canonical lifecycle records and stable artifact identity references
2. explicit states for live, retained, expired, tombstoned, and deleted
3. deterministic retention policy evaluation from bounded local inputs
4. atomic state transitions with recovery
5. deterministic age/tag/reference queries and bounded purge planning
6. immutable snapshots and typed fail-closed errors
7. conflict/invalid-transition rejection
8. deterministic serialization with checksum and corruption detection
9. dry-run purge planning without destructive side effects
10. no required network service or external SDK
11. zero runtime third-party dependencies
12. unit, contract, failure, recovery, and cross-platform verification
13. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Lifecycle / Retention Index v0.1, allowed scope is only:

- local lifecycle state
- deterministic retention policy evaluation
- bounded records and query/purge-plan output
- atomic lifecycle mutations and recovery
- dry-run purge planning
- immutable snapshots
- deterministic serialization and corruption detection
- typed fail-closed errors
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- destructive physical deletion from arbitrary storage backends
- remote synchronization
- network transport
- distributed locks
- billing or cost accounting
- GUI/admin console
- background scheduler integration
- legal/compliance retention policy engines

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
