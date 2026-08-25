# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Local Artifact Catalog / Package Index Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Bundle / Reproducible Package v0.1**
- Release PR: **#62**, squash-merged
- Release commit: `a1d2655e7d48b63ce6ded71e4e449ea2c3a841dd`
- Pre-merge verification: **Run 458**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 459**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Bundle / Reproducible Package v0.1 is therefore **FROZEN**.
- The release provides deterministic SAB1 bundles, canonical metadata and paths, bounded entries, native SHA-256 integrity descriptors, safe verification/extraction, typed fail-closed errors, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**LOCAL-ARTIFACT-CATALOG-PACKAGE-INDEX-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic local artifact catalog/package index:

1. canonical artifact records and stable identifiers
2. deterministic package/version metadata normalization
3. bounded catalog size, record size, identifier length, and query output
4. atomic add/update/remove semantics with recovery
5. deterministic exact/prefix/tag/version queries
6. immutable snapshots and typed fail-closed errors
7. duplicate/conflicting record rejection
8. corruption detection for persisted index state
9. deterministic serialization suitable for backup/restore
10. no required network service, registry, or external SDK
11. zero runtime third-party dependencies
12. unit, contract, failure, recovery, and cross-platform verification
13. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Local Artifact Catalog / Package Index v0.1, allowed scope is only:

- local catalog/index state
- deterministic artifact identity and metadata normalization
- bounded record storage and query output
- exact/prefix/tag/version queries
- atomic mutations and recovery
- immutable public snapshots
- deterministic serialization and corruption detection
- typed fail-closed errors
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- remote registries
- package publishing
- network transport
- dependency resolution across remote sources
- signing/key management
- GUI/admin console
- full semantic-version solver
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
