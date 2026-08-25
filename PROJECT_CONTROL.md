# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Release Publication Executor / Boundary Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Release Closure Receipt v0.1**
- Release PR: **#75**, squash-merged
- Release commit: `0e1adc1fc41924c4df14c5b10aa5ed1278297b90`
- Pre-merge verification: **Run 555**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 556**, push on `main` for the release commit, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke. The Windows browser gate initially cancelled and was rerun independently; the rerun completed successfully.
- Artifact Release Closure Receipt v0.1 is therefore **FROZEN**.
- The release provides exact snapshot/approval linkage, approved-status enforcement, bounded immutable closure metadata/evidence, SRC1 checksum-protected serialization, typed fail-closed errors, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-RELEASE-PUBLICATION-EXECUTOR-BOUNDARY-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic publication boundary that consumes one frozen closure receipt and executes only explicitly authorized publication intents:

1. accept one explicit frozen closure receipt plus explicit publication intent records
2. validate exact closure receipt identity/status before any side effect
3. require an explicit destination capability and operation allowlist
4. normalize publication intents and destination metadata deterministically
5. reject duplicate/conflicting intents, unsupported destinations, malformed/accessor/circular inputs, and oversized payload metadata
6. plan and execute publication steps with bounded immutable outcomes and typed failures
7. make each side-effect boundary explicit, auditable, and fail-closed
8. never discover destinations or mutate unrelated artifacts
9. no implicit network/filesystem/registry scanning, scheduler, signing, or credential acquisition
10. zero runtime third-party dependencies in the core cube
11. unit, contract, failure, recovery, idempotency, rollback-safety, and cross-platform verification
12. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Release Publication Executor / Boundary v0.1, allowed scope is only:

- explicit frozen closure receipt input
- explicit publication intent records
- explicit destination capability contracts
- deterministic intent normalization and validation
- bounded immutable publication plans/outcomes
- typed fail-closed errors
- explicit side-effect boundaries
- idempotency and recovery semantics
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- destination discovery
- secret/credential management
- automatic retries across unknown systems
- scheduler/orchestration
- trust-chain/signature generation or verification
- GUI/admin console
- billing or cost accounting
- broad deployment platform integration

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
