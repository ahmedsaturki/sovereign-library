# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Storage Persistence / Snapshot v0.1** and release it before starting another cube.

## Current repository state

- Last released cube: **Workflow / Durable Orchestration v0.1**
- Release PR: **#51**, squash-merged
- Release commit: `f3b38368b7865aafd85e69b98f11f076f53b01be`
- Pre-merge verification: **Run 379**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 380**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Workflow / Durable Orchestration v0.1 is therefore **FROZEN**.
- A repeated macOS Worker Pool timeout-test flake was converted into a deterministic recovery assertion and the full Worker Pool suite was restored before release.
- `ROADMAP.md` and `README.md` were updated to record the release and activate Storage Persistence / Snapshot.
- Duplicate Redaction PR #47 remains closed as superseded by PR #45.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**STORAGE-PERSISTENCE-SNAPSHOT-V0.1-SPEC**

### Immediate next task

Freeze the public contract for a standalone native persistence/snapshot product:

1. define versioned snapshot envelope and format identity
2. define deterministic encode/decode semantics over Sovereign-compatible data
3. define atomic save/load behavior using standard filesystem primitives only
4. define checksum/integrity verification and corruption detection
5. define crash-safe temporary-file and rename recovery semantics
6. define bounded snapshot size, record count, and nesting work
7. define immutable loaded snapshots and source immutability
8. define typed fail-closed errors without arbitrary payload copying
9. define explicit format versioning and forward-incompatibility behavior
10. define recovery behavior after truncated or partially written snapshots
11. verify zero runtime third-party dependencies
12. define unit, contract, integration, failure, and recovery gates
13. write the standalone cube specification before implementation

## Scope lock

For Storage Persistence / Snapshot v0.1, the allowed scope is only:

- local filesystem persistence
- deterministic versioned snapshot envelope
- native binary or text encoding built from standard APIs
- checksum/integrity verification
- atomic write via temporary file + rename semantics
- load, validate, and recover from interrupted writes
- bounded snapshot size, records, nesting, and payloads
- immutable loaded snapshots
- source immutability
- typed fail-closed diagnostics
- unit/contract/integration/failure/recovery tests
- cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- remote/object storage
- distributed consensus
- databases
- compression formats beyond native standard APIs where already available
- encryption/key management
- filesystem watching
- synchronization/replication
- third-party serialization packages
- network transport

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

Every blocking bug or CI failure must produce all of the following before release:

- root-cause identification
- minimal fix
- regression test
- CI protection when applicable
- documentation or control update when the lesson affects future work

## Clean-repository rule

`main` is the product branch. Temporary verification branches and PRs must not become runtime artifacts. Release merges should prefer a clean, single-purpose history. No marker files, generated dependency trees, vendor directories, or unused compatibility layers belong in the product.

## Decision rule

When uncertain, choose the smallest implementation that satisfies the current contract and can later be replaced without breaking consumers.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart the project from memory.

## Release sequence

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

No step may be skipped by calling the project complete early.
