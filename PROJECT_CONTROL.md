# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Bundle / Reproducible Package Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Content-Addressed Storage / CAS v0.1**
- Release PR: **#61**, squash-merged
- Release commit: `63ba1b7e684857e95303b02864c91627a6c601e0`
- Pre-merge verification: **Run 450**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 451**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Content-Addressed Storage / CAS v0.1 is therefore **FROZEN**.
- The release provides native SHA-256 content addressing, bounded local object storage, atomic writes, corruption detection, immutable-by-copy reads, bounded metadata, and typed fail-closed errors with zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-BUNDLE-REPRODUCIBLE-PACKAGE-V0.1-SPEC**

### Immediate next task

Freeze and implement the public contract for a standalone deterministic package/bundle component:

1. deterministic file ordering and normalized bundle paths
2. reproducible bundle metadata and stable serialization
3. bounded entry count, path length, per-entry size, and total bundle size
4. native local archive/bundle generation without a network service
5. explicit versioned bundle format and integrity descriptors
6. safe path validation and traversal rejection
7. immutable bundle manifests and verification results
8. fail-closed malformed bundles, duplicates, unsupported metadata, and corrupt content
9. deterministic extraction/verification behavior without arbitrary command execution
10. zero runtime third-party dependencies
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, and runnable example before release

## Scope lock

For Artifact Bundle / Reproducible Package v0.1, allowed scope is only:

- local deterministic bundle generation
- canonical path normalization and stable entry ordering
- versioned bundle format and metadata
- bounded archive inputs and outputs
- native integrity descriptors
- deterministic verification and safe extraction
- immutable public snapshots
- typed fail-closed errors
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- remote registries
- package publishing
- signing/key management
- remote replication
- GUI/admin console
- network transport
- installer generation
- operating-system package formats

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
