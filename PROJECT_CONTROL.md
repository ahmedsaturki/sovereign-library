# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Execution Engine Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Policy / Capability Security v0.1**
- Release PR: **#56**, squash-merged
- Release commit: `a1067431f06d20ad2bdce321590ded9e79471d02`
- Pre-merge verification: **Run 418**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, contract/integration tests, and real-browser smoke.
- Post-merge verification: **Run 419**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, contract/integration tests, and real-browser smoke.
- Policy / Capability Security v0.1 is therefore **FROZEN**.
- The release provides deterministic local authorization decisions, explicit allow/deny capability records, hierarchical action/resource matching, deterministic precedence, bounded contextual inputs, fail-closed validation, immutable audit records, composable public snapshots, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**EXECUTION-ENGINE-V0.1-SPEC**

### Immediate next task

Freeze and implement the public contract for a standalone deterministic execution engine:

1. immutable execution definitions and normalized task records
2. deterministic task ordering and execution state transitions
3. explicit success, failure, cancellation, timeout, and skipped outcomes
4. bounded task count, payload size, execution depth, and diagnostics
5. dependency-aware execution without hidden ambient authority
6. deterministic retry and recovery semantics at the execution layer
7. immutable execution snapshots and auditable result records
8. fail-closed malformed definitions, cycles, duplicate ids, and unsupported values
9. no network, scheduler service, worker framework, or external orchestration SDK requirement
10. zero runtime third-party dependencies
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, and runnable example before release

## Scope lock

For Execution Engine Cube v0.1, allowed scope is only:

- local deterministic task execution
- immutable task definitions and execution snapshots
- dependency ordering and state transitions
- success/failure/cancel/timeout/skipped semantics
- bounded execution context and diagnostics
- deterministic retry/recovery policy
- typed fail-closed errors
- immutable audit/result records
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- distributed execution
- remote workers
- cron/scheduling service integration
- GUI/admin console
- network orchestration
- queue broker integration
- multi-agent orchestration
- browser automation

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
