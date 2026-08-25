# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Workflow / Durable Orchestration Cube v0.1** and release it before starting another cube.

## Current repository state

- Last released cube: **Search / Index v0.1**
- Release PR: **#50**, squash-merged
- Release commit: `e124f7cfa59880c0c0381863a5215f3bc2bd08f4`
- Pre-merge verification: **Run 371**, passed after a macOS-only timing-sensitive Worker Pool failure was rerun successfully; Search-specific tests remained green.
- Post-merge verification: **Run 372**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Search / Index v0.1 is therefore **FROZEN**.
- `ROADMAP.md` and `README.md` were updated to record the release and activate Workflow / Durable Orchestration.
- Duplicate Redaction PR #47 remains closed as superseded by PR #45.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**WORKFLOW-DURABLE-ORCHESTRATION-V0.1-SPEC**

### Immediate next task

Freeze the public contract for a standalone native Workflow / Durable Orchestration product:

1. define workflow and step contracts
2. define deterministic execution state and transition rules
3. define sequential, parallel, and conditional step composition
4. define durable event/history records and replay semantics
5. define retry, timeout, cancellation, and compensation boundaries
6. define deterministic scheduling and idempotency rules
7. define bounded history, steps, payloads, fan-out, retries, and replay work
8. define immutable snapshots and source immutability
9. define typed fail-closed errors without arbitrary payload copying
10. define crash/restart recovery and replay behavior
11. verify zero runtime third-party dependencies
12. define unit, contract, integration, failure, and recovery gates
13. write the standalone cube specification before implementation

## Scope lock

For Workflow / Durable Orchestration Cube v0.1, the allowed scope is only:

- local in-process workflow definitions
- deterministic step state machine
- sequential and bounded parallel step execution
- deterministic conditional branching
- durable in-memory execution history
- replay from history
- retry and timeout policy
- cancellation propagation
- idempotent step execution keys
- bounded fan-out and history/payload sizes
- immutable execution snapshots/results
- source immutability
- typed fail-closed diagnostics
- local unit, contract, integration, failure, and recovery tests
- cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- network workflow orchestration
- distributed workers
- external durable databases
- cron/scheduled triggers
- third-party workflow engines
- remote task queues
- BPMN/visual editors
- external service integrations
- learned planning or agent behavior

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
