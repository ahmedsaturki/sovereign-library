# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Dependency Graph / Relationship Index Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Local Artifact Catalog / Package Index v0.1**
- Release PR: **#63**, squash-merged
- Release commit: `58fdd97ed36bf058843c83e2ad226a20d85fb446`
- Pre-merge verification: **Run 465**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 466**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Local Artifact Catalog / Package Index v0.1 is therefore **FROZEN**.
- The release provides deterministic SAC1 catalog state, stable artifact identifiers, exact/prefix/package/version/tag queries, atomic persistence, corruption detection, immutable snapshots, typed fail-closed errors, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-DEPENDENCY-GRAPH-RELATIONSHIP-INDEX-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic local artifact relationship/graph index:

1. canonical nodes and typed directed relationships
2. stable relationship identifiers and deterministic adjacency ordering
3. bounded node/edge count, identifier length, label length, and query output
4. atomic add/remove relationship mutations with recovery
5. deterministic exact-neighbor, reverse-neighbor, and path-within-bound queries
6. cycle detection and explicit duplicate/conflict rejection
7. immutable graph snapshots and typed fail-closed errors
8. deterministic serialization with checksum and corruption detection
9. safe restore without code execution or external resolution
10. no required network service or external SDK
11. zero runtime third-party dependencies
12. unit, contract, failure, recovery, and cross-platform verification
13. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Dependency Graph / Relationship Index v0.1, allowed scope is only:

- local graph/index state
- deterministic node/relationship identity
- bounded graph state and query output
- exact/reverse/path-within-bound queries
- atomic relationship mutations and recovery
- cycle detection
- immutable snapshots
- deterministic serialization and corruption detection
- typed fail-closed errors
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- remote graph synchronization
- remote dependency resolution
- semantic-version solving
- package publishing
- network transport
- GUI/admin console
- graph visualization UI
- background synchronization

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
