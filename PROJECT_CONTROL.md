# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Reference Resolver / Locator Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Lifecycle / Retention Index v0.1**
- Release PR: **#65**, squash-merged
- Release commit: `da1f4992c0f84422f9e43a5c5037af1e28e85fc9`
- Pre-merge verification: **Run 480**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 481**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Lifecycle / Retention Index v0.1 is therefore **FROZEN**.
- The release provides deterministic lifecycle records, explicit live/retained/expired/tombstoned/deleted states, bounded retention evaluation, atomic transitions, dry-run retention/purge planning, checksum-protected persistence, immutable snapshots, typed fail-closed errors, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-REFERENCE-RESOLVER-LOCATOR-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic local artifact reference resolver/locator:

1. canonical artifact reference grammar for name, version, digest, and tag forms
2. deterministic normalization and validation of local references
3. resolution across an explicit bounded in-memory candidate set
4. exact, alias, and version-range-free deterministic matching only
5. explicit ambiguity and not-found outcomes with typed errors
6. bounded candidate/result limits and fail-closed invalid input handling
7. immutable resolution snapshots and stable result ordering
8. no hidden network access, filesystem scanning, registry lookup, or external SDK
9. zero runtime third-party dependencies
10. unit, contract, failure, recovery, and cross-platform verification
11. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Reference Resolver / Locator v0.1, allowed scope is only:

- local artifact reference parsing and normalization
- bounded explicit candidate resolution
- deterministic exact/alias matching
- ambiguity/not-found reporting
- immutable snapshots
- typed fail-closed errors
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- remote registries
- network transport
- implicit filesystem discovery
- semantic version range solving
- dependency installation
- destructive lifecycle operations
- GUI/admin console
- background scheduler integration
- billing or cost accounting

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
