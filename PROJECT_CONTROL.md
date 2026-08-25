# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Reconciliation / Consistency Checker Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Provenance / Lineage Ledger v0.1**
- Release PR: **#67**, squash-merged
- Release commit: `d1b2795d3a638100a6fbf657cbebeb5ef7aaae82`
- Pre-merge verification: **Run 497**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 498**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Provenance / Lineage Ledger v0.1 is therefore **FROZEN**.
- The release provides deterministic append-only provenance events, explicit lineage relationships, bounded ancestry/descendant traversal, immutable snapshots, typed fail-closed errors, checksum-protected serialization, corruption detection, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-RECONCILIATION-CONSISTENCY-CHECKER-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic artifact reconciliation/consistency checker:

1. canonical normalization of explicit artifact records from independent snapshots
2. deterministic detection of missing, extra, duplicated, and conflicting records
3. explicit identity, digest, version, lineage, and lifecycle consistency checks
4. bounded comparison inputs and bounded mismatch reports
5. deterministic severity/category classification without external policy engines
6. immutable reconciliation reports and stable ordering
7. fail-closed malformed/accessor/circular input rejection with recovery
8. deterministic serialization of reports with checksum/integrity protection
9. no network, filesystem discovery, registry lookup, or external SDK required
10. zero runtime third-party dependencies
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Reconciliation / Consistency Checker v0.1, allowed scope is only:

- explicit local snapshot comparison
- deterministic artifact identity and digest consistency checks
- lifecycle and lineage consistency checks from supplied data
- bounded mismatch reporting
- immutable reports
- typed fail-closed errors
- checksum-protected report serialization
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- remote synchronization
- automatic network/filesystem/registry discovery
- automatic repair or mutation of source snapshots
- distributed reconciliation protocols
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
