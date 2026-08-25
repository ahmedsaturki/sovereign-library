# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Content-Addressed Storage / CAS Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Release Manifest / Integrity v0.1**
- Release PR: **#59**, squash-merged
- Release commit: `d1e33a2cfb12303cfe7e810e17241636ffa998db`
- Pre-merge verification: **Run 437**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, 390 tests, and real-browser smoke.
- Post-merge verification: **Run 438**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Release Manifest / Integrity v0.1 is therefore **FROZEN**.
- The release provides deterministic versioned manifests, native SHA-256 content descriptors, immutable verification reports, bounded local inputs, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**CONTENT-ADDRESSED-STORAGE-V0.1-SPEC**

### Immediate next task

Freeze and implement the public contract for a standalone deterministic content-addressed storage component:

1. canonical content-to-address mapping with native digest primitives
2. immutable put/get/has/delete semantics
3. deterministic address validation and normalization
4. atomic write and collision-safe existing-object handling
5. bounded object size, object count, address length, and metadata size
6. safe namespace separation and path traversal rejection
7. immutable object metadata and snapshots
8. fail-closed corruption and malformed-address handling
9. recovery behavior after rejected writes and corrupted records
10. zero runtime third-party dependencies and no network requirement
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, and runnable example before release

## Scope lock

For Content-Addressed Storage / CAS Cube v0.1, allowed scope is only:

- local content-addressed storage
- native digest-based addressing
- deterministic CRUD semantics
- bounded objects and metadata
- immutable metadata/snapshots
- corruption detection
- safe namespace and path handling
- atomic persistence and recovery
- typed fail-closed errors
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- remote replication
- distributed consensus
- object locking service
- encryption/key management
- HTTP/network transport
- GUI/admin console
- package registry or publishing service

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
