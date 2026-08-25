# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Reporting / Export Cube v0.1** and release it before starting another cube.

## Current repository state

- Last released cube: **Storage Persistence / Snapshot v0.1**
- Release PR: **#52**, squash-merged
- Release commit: `6ed90856cc66c9894ae948731769d23d0e9a40a5`
- Pre-merge verification: **Run 389**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 390**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke. fileciteturn446file0L1-L6
- Storage Persistence / Snapshot v0.1 is therefore **FROZEN**.
- The release provides deterministic versioned snapshot envelopes, checksum verification, atomic replacement, bounded local persistence, immutable loaded snapshots, typed fail-closed diagnostics, and zero runtime third-party dependencies.
- `ROADMAP.md` and `README.md` must now record the release and activate Reporting / Export.
- Duplicate Redaction PR #47 remains closed as superseded by PR #45.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**REPORTING-EXPORT-V0.1-SPEC**

### Immediate next task

Freeze the public contract for a standalone native Reporting / Export product:

1. define immutable report document and section contracts
2. define deterministic aggregation, ordering, grouping, and pagination semantics
3. define stable CSV and JSON export formats with explicit escaping/null/date rules
4. define bounded text/row/cell/output work
5. define streaming export behavior for large result sets
6. define reproducible report metadata without environment-specific noise
7. define immutable report snapshots and source immutability
8. define typed fail-closed diagnostics without arbitrary payload copying
9. define cancellation and partial-output behavior
10. define recovery after failed or interrupted exports
11. verify zero runtime third-party dependencies
12. define unit, contract, integration, failure, recovery, and cross-platform gates
13. write the standalone cube specification before implementation

## Scope lock

For Reporting / Export Cube v0.1, the allowed scope is only:

- local in-process report definitions
- deterministic aggregation and ordering
- deterministic grouping and bounded pagination
- immutable report snapshots
- JSON export
- CSV export
- bounded streaming export
- cancellation-aware output
- bounded report/output work
- source immutability
- typed fail-closed diagnostics
- local unit, contract, integration, failure, and recovery tests
- cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- PDF rendering
- chart/image generation
- spreadsheets with proprietary formats
- database query engines
- network reporting APIs
- external BI services
- templating engines
- third-party reporting libraries

## Definition of done

A milestone is DONE only when:

- implementation exists
- public API is documented
- normal-path tests pass
- failure-path tests pass
- cleanup/restart behavior is verified where applicable
- supported-platform checks pass or documented capability limits exist
- example usage works
- release artifact is reproducible
- no known blocking defect remains
- `ROADMAP.md` is updated
- `PROJECT_CONTROL.md` points to the next active milestone

## Anti-loop rules

- Do not redesign the whole architecture during a cube release.
- Do not add a new dependency to solve a local problem without recording the decision.
- Do not start a second cube because the current cube is difficult.
- Do not expand scope because a competitor has more features.
- Do not call a cube production-ready from source inspection alone.
- If a problem is outside the active scope, park it and continue.

## Lessons-learned rule

Every blocking bug or CI failure must produce:

- root-cause identification
- minimal fix
- regression test
- CI protection when applicable
- documentation/control update when the lesson affects future work

## Clean-repository rule

`main` is the product branch. Temporary verification branches and PRs must not become runtime artifacts. Release merges should prefer a clean, single-purpose history. No marker files, generated dependency trees, vendor directories, or unused compatibility layers belong in the product.

## Decision rule

When uncertain, choose the smallest implementation that satisfies the current contract and can later be replaced without breaking consumers.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart the project from memory.

## Release sequence

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

No step may be skipped by calling the project complete early.
