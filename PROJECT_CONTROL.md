# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Release / Verification Harness Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Execution Engine v0.1**
- Release PR: **#57**, squash-merged
- Release commit: `739798bb3de3d50884dc7b3f28bada7e4f58f1a2`
- Pre-merge verification: **Run 424**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 425**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Execution Engine v0.1 is therefore **FROZEN**.
- The release provides deterministic dependency-aware local task execution, explicit success/failure/cancel/timeout/skipped outcomes, bounded execution, retry/recovery, immutable snapshots/results, typed fail-closed errors, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**RELEASE-VERIFICATION-HARNESS-V0.1-SPEC**

### Immediate next task

Freeze and implement the public contract for a standalone deterministic release-verification harness:

1. explicit verification stage definitions and normalized commands
2. deterministic stage ordering and lifecycle states
3. native child-process execution without shell dependence
4. bounded stdout/stderr capture and diagnostic limits
5. per-stage timeout, cancellation, retry, and terminal outcomes
6. deterministic aggregation of stage results into a release verdict
7. immutable verification snapshots and machine-readable reports
8. fail-closed malformed definitions and unsafe command configuration
9. no network service or CI-provider SDK requirement
10. zero runtime third-party dependencies
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, and runnable example before release

## Scope lock

For Release / Verification Harness Cube v0.1, allowed scope is only:

- local deterministic release-stage orchestration
- native child-process execution
- bounded output and diagnostics
- timeout/cancellation/retry semantics
- deterministic pass/fail/skip aggregation
- immutable verification reports
- typed fail-closed errors
- safe command allowlisting and argument validation
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- hosted CI control planes
- GitHub/Azure/GitLab provider SDKs
- remote execution
- distributed agents
- secrets management
- GUI/admin console
- browser automation implementation

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
