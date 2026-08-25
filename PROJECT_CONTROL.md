# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Release Plan / Deterministic Publication Plan Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Admission Gate / Release Eligibility v0.1**
- Release PR: **#71**, squash-merged
- Release commit: `29be5dc41556cb7aafa5fc0a4cd1ccb08ef2c157`
- Pre-merge verification: **Run 530**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 531**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Admission Gate / Release Eligibility v0.1 is therefore **FROZEN**.
- The release provides deterministic required/optional admission clauses, release eligibility verdicts, immutable blocking/non-blocking reasons, typed fail-closed errors, SAG1 checksum-protected serialization, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-RELEASE-PLAN-DETERMINISTIC-PUBLICATION-PLAN-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic artifact release-plan builder:

1. accept an explicit set of eligible artifact records and an explicit release-plan configuration only
2. validate uniqueness, dependencies, required admission verdicts, and deterministic release constraints
3. compute stable release ordering without network access, mutation, or hidden discovery
4. emit bounded immutable release-plan steps and dependency evidence
5. detect dependency cycles and impossible release prerequisites fail-closed
6. support deterministic dry-run plans with no publication side effects
7. serialize and parse plans deterministically with checksum/integrity protection
8. preserve evidence references without copying unbounded artifact payloads
9. no network, filesystem discovery, registry lookup, scheduler, or actual publication
10. zero runtime third-party dependencies
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Release Plan / Deterministic Publication Plan v0.1, allowed scope is only:

- explicit local artifact data
- explicit release-plan configuration
- deterministic dependency validation and ordering
- immutable dry-run release plans
- typed fail-closed errors
- deterministic checksum-protected plan serialization
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- actual publication or deployment
- network/filesystem/registry discovery
- remote release APIs
- background scheduling/orchestration
- signing/trust-chain verification
- automatic artifact mutation or repair
- GUI/admin console
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
