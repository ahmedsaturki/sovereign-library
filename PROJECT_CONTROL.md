# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Complete **Atomic Batch File Transaction / Safe Multi-File Commit v0.1** through the required release sequence without skipping gates.

## Current repository state

- Last released cube: **Bounded File Content Reader / Safe Content Access v0.1**
- Latest corrective release: **File Lease / Advisory Lock v0.1 hardening**
- Corrective PR: **#95**, merged at `a2eb715a558d9c88f19e9ff83ff512971e548891`
- Corrective verification: **Run #700**, passed on Ubuntu, Windows, and macOS-15-Intel after a macOS-only rerun.
- Corrective mainline verification: **Run #701**, passed on Ubuntu and Windows, and passed on macOS after a fresh macOS-only rerun. Syntax, full tests, browser smoke, and complete jobs all passed.
- File Lease / Advisory Lock v0.1 is **FROZEN** with corrective hardening at `a2eb715a558d9c88f19e9ff83ff512971e548891`.
- Current active cube: **Atomic Batch File Transaction / Safe Multi-File Commit v0.1**.
- SPEC commit: `7aa2a82f3acc1b8e4593654894fdb2625aed3789`.
- Implementation PR: **#96**.
- Current implementation head: `f3df382b5916429c94bfc6ad60120c8fae684f17`.
- Current hardening scope: absolute-root enforcement, proof-gated `strong-local` atomicity, truthful post-cleanup rollback availability reporting, immutable ABT1 receipts, bounded planning, and fail-closed recovery.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ATOMIC-BATCH-FILE-TRANSACTION-V0.1**

### Immediate next task

Run the final cross-platform Verify on the current implementation head. If failures exist, identify root cause, apply minimal fix plus regression coverage, and repeat. If green, release and freeze before selecting the next cube.

No implementation of another cube starts before this release gate is complete.

## Scope lock

Do not redesign the architecture. This cube is limited to bounded batch planning, preflight, owned staging, create/replace/delete operations, rollback/recovery semantics, integrity-protected immutable receipts, capability/data separation, privacy-safe diagnostics, and cross-platform filesystem behavior.

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
