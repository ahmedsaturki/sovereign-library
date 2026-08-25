# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Concurrency / Bulkhead Cube v0.1** and release it before starting another cube.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**CONCURRENCY-BULKHEAD-V0.1-RELEASE**

### Immediate next task

Complete the Concurrency / Bulkhead Cube release gate:

1. write and freeze the concurrency admission and lease contract
2. define immediate admission and bounded FIFO waiting
3. verify fair waiter ordering
4. verify cancellation and queue cleanup via AbortSignal
5. verify release lifecycle and double-release protection
6. verify queue overflow and shutdown behavior
7. verify immutable statistics snapshots and deterministic state
8. run syntax, unit, contract, integration, failure, and recovery tests
9. verify zero runtime third-party dependencies
10. run the supported cross-platform CI matrix
11. fix only failures required for the v0.1 gate
12. mark the release gate complete

## Scope lock

For Concurrency / Bulkhead Cube v0.1, the allowed scope is only:

- configurable concurrency limit
- immediate/non-blocking admission check
- bounded FIFO waiting queue
- fair waiter ordering
- queued cancellation via AbortSignal
- release/lease lifecycle with double-release protection
- queue overflow behavior
- deterministic clock integration where waiting timers are required
- immutable statistics snapshots
- cleanup and shutdown semantics
- documentation
- local unit/integration/failure/recovery tests

Explicitly out of scope for v0.1:

- distributed semaphore state
- remote coordination or Redis
- priority scheduling
- work stealing
- adaptive ML-based concurrency
- third-party concurrency libraries
- tracing/telemetry backend
- AI agent runtime

## Definition of done

A milestone is DONE only when:

- implementation exists
- public API is documented
- normal-path tests pass
- failure-path tests pass
- cleanup/restart behavior is verified
- supported-platform checks pass or documented capability limits exist
- example usage works
- release artifact is reproducible
- no known blocking defect remains
- ROADMAP is updated

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
