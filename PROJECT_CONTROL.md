# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Task Scheduler / Queue Cube v0.1** and release it before starting another cube.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**TASK-SCHEDULER-QUEUE-V0.1-RELEASE**

### Immediate next task

Complete the Task Scheduler / Queue Cube release gate:

1. write and freeze the task/queue contract
2. run syntax, unit, contract, integration, failure, recovery, and shutdown tests
3. verify FIFO/priority ordering and bounded concurrency
4. verify delay, retry, cancellation, timeout, idempotency, backpressure, and queue limits
5. verify graceful shutdown/drain behavior
6. verify deterministic clock injection in tests
7. verify zero runtime third-party dependencies
8. run the supported cross-platform CI matrix
9. fix only failures required for the v0.1 gate
10. mark the release gate complete

## Scope lock

For Task Scheduler / Queue Cube v0.1, the allowed scope is only:

- task contract
- task lifecycle states
- in-memory FIFO/priority queue
- bounded concurrency
- deterministic scheduling
- delay/not-before execution
- retries with explicit retry policy
- cancellation
- timeout
- backpressure and queue limits
- idempotency keys
- task result/error capture
- graceful shutdown and drain
- deterministic clock injection
- documentation
- tests

Explicitly out of scope for v0.1:

- distributed queues
- persistence
- cron parser
- workflow DAG engine
- pub/sub
- distributed locks
- remote workers
- Redis clients
- queue/worker frameworks
- third-party scheduler packages
- AI agent runtime

Those become future cubes or future releases only after v0.1 is released.

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
