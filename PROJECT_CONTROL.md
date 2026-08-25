# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Audit / Drift Reporter Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Reconciliation / Consistency Checker v0.1**
- Release PR: **#68**, squash-merged
- Release commit: `9dfb6833299cbfc42c82afdef5fcf2d3a6175833`
- Pre-merge verification: **Run 504**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 505**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Reconciliation / Consistency Checker v0.1 is therefore **FROZEN**.
- The release provides deterministic explicit snapshot normalization, missing/extra/duplicate detection, identity/digest/version/lifecycle/lineage consistency checks, bounded immutable mismatch reports, typed fail-closed errors, checksum-protected report serialization, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-AUDIT-DRIFT-REPORTER-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic local artifact audit / drift reporter:

1. accept explicit local artifact records or snapshots only
2. validate stable artifact identity, digest, version, lifecycle, and lineage fields
3. detect drift classes deterministically without mutating source data
4. produce bounded severity/category audit findings with stable ordering
5. support baseline-versus-current comparisons and unchanged/changed/added/removed classification
6. support immutable audit snapshots and replay-safe reads
7. fail closed on malformed, accessor, circular, duplicate, or oversized inputs
8. serialize audit reports deterministically with checksum/integrity protection
9. no network, filesystem discovery, registry lookup, or external SDK required
10. zero runtime third-party dependencies
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Audit / Drift Reporter v0.1, allowed scope is only:

- explicit local artifact audit input
- deterministic drift classification
- baseline/current comparison
- bounded immutable findings and reports
- typed fail-closed errors
- deterministic checksum-protected serialization
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- remote synchronization
- automatic network/filesystem/registry discovery
- automatic repair or mutation of source artifacts
- distributed audit protocols
- trust/signature policy engines
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
