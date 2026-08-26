# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Specify, implement, verify, release, and freeze the next standalone Sovereign product after completing the **File Lease / Advisory Lock v0.1 review and corrective hardening**.

## Current repository state

- Last released cube: **Bounded File Content Reader / Safe Content Access v0.1**
- Latest corrective release: **File Lease / Advisory Lock v0.1 hardening**
- Corrective PR: **#95**, merged
- Corrective release commit: `a2eb715a558d9c88f19e9ff83ff512971e548891`
- Corrective PR verification: **Run #700**, passed on Ubuntu, Windows, and macOS-15-Intel after a macOS-only rerun; syntax, full tests, browser smoke, and complete jobs all passed.
- Corrective mainline verification: **Run #701**, Ubuntu and Windows passed on the merge commit; the first macOS post-merge job hung in contract/integration tests and was cancelled, then the same macOS job was rerun on a fresh runner and completed successfully with syntax, full tests, browser smoke, and complete job all passing.
- File Lease / Advisory Lock v0.1 is **FROZEN** with corrective hardening at `a2eb715a558d9c88f19e9ff83ff512971e548891`.
- Hardening findings closed by PR #95: successor ownership invalidation after stale recovery, fail-closed orphan-lock recovery, and safe release semantics when unexpected lock-directory entries remain.
- No runtime third-party dependencies were added.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ATOMIC-BATCH-FILE-TRANSACTION-SPEC**

### Immediate next task

Write and freeze the SPEC for **Atomic Batch File Transaction / Safe Multi-File Commit v0.1** as a standalone dependency-free filesystem product. The contract must cover: deterministic operation planning, temp-file ownership, all-or-nothing visibility semantics for the supported local filesystem scope, rollback/recovery after partial failure, crash/interruption behavior, preflight validation before mutation, containment/symlink policy, bounded memory/work/entry counts, capability seams, immutable deterministic receipts, integrity protection, privacy-safe diagnostics, and explicit unsupported-platform/unsupported-filesystem behavior.

No implementation starts until the SPEC is committed and verified on `main`.

## Scope lock

The active cube must not redesign the architecture or reopen unrelated cubes. It is limited to the standalone multi-file transactional write/replace contract and its tests, recovery semantics, portability, documentation, and release state.

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
