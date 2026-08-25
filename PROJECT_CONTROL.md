# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign cube after freezing **Runtime Capability Inspector / Preflight v0.1**.

## Current repository state

- Last released cube: **Runtime Capability Inspector / Preflight v0.1**
- Release PR: **#78**, squash-merged
- Release commit: `139a7d6c824b7fe522712c65e1b9ffcf605e134f`
- Pre-merge verification: **Run 580**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 581**, passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.
- Runtime Capability Inspector / Preflight v0.1 is **FROZEN**.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**NEXT-CUBE-SELECTION**

### Immediate next task

Define the next standalone product as **Filesystem Watcher / Change Stream v0.1** and write its SPEC before implementation.

Selection rationale:

- the repository already has filesystem read/write primitives, but no standalone temporal observation/change-stream product
- the cube has an independent product boundary: observe changes, normalize events, control lifecycle, and provide bounded backpressure/recovery
- it does not require the Filesystem cube internally and must remain usable as a standalone product
- native platform APIs can provide the capability without a runtime third-party package
- it is valuable for agents, editors, sync engines, caches, build systems, and automation while remaining explicitly read-only with respect to watched targets

SPEC gate must define:

1. normalized create/change/remove/rename event semantics
2. lifecycle, close, error, and recovery behavior
3. debounce/coalescing policy as explicit opt-in behavior
4. bounded queue/backpressure semantics
5. recursive watching semantics and platform limitations
6. symlink and path containment rules
7. duplicate/noise suppression without inventing events
8. deterministic test hooks and injected event source where needed
9. cross-platform contract across Ubuntu, Windows, macOS-15-Intel, and WSL
10. zero-runtime-third-party-dependency boundary

No implementation of the next cube begins before this SPEC gate is complete.

## Scope lock

Runtime Capability Inspector / Preflight v0.1 is released and frozen. No additional feature work may be added to that cube outside a separately authorized future version.

## Definition of done

A milestone is DONE only when implementation, public API documentation, normal and failure-path tests, recovery behavior, examples, reproducible release state, cross-platform gates, and roadmap/control updates all pass.

## Anti-loop rules

- Do not redesign the whole architecture during a cube release.
- Do not add a dependency to solve a local problem without recording the decision.
- Do not start a second cube while the current cube is unfinished.
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
