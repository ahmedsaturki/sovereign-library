# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Filesystem Watcher / Change Stream v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Runtime Capability Inspector / Preflight v0.1**
- Release PR: **#78**, squash-merged
- Release commit: `139a7d6c824b7fe522712c65e1b9ffcf605e134f`
- Pre-merge verification: **Run 580**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 581**, passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.
- Runtime Capability Inspector / Preflight v0.1 is **FROZEN**.
- Next cube SPEC is committed at `specs/filesystem-watcher-change-stream-v0.1.md`.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**FILESYSTEM-WATCHER-CHANGE-STREAM-V0.1-SPEC**

### Immediate next task

Implement the public contract defined in `specs/filesystem-watcher-change-stream-v0.1.md`:

1. normalize create/change/remove/rename events
2. implement explicit lifecycle, close, error, and recovery behavior
3. support opt-in deterministic debounce/coalescing
4. enforce bounded queue and explicit overflow/backpressure policy
5. implement recursive watching with documented platform limitations
6. enforce symlink and root containment rules
7. suppress only documented native noise/duplicates without inventing events
8. provide a deterministic injected event source for contract tests
9. verify Ubuntu, Windows, macOS-15-Intel, and WSL boundaries
10. remain zero-runtime-third-party-dependency and fully documented/tested

## Scope lock

Allowed scope for Filesystem Watcher / Change Stream v0.1:

- read-only observation of explicitly configured filesystem roots
- native filesystem event adapters
- normalized immutable event stream
- bounded queue/backpressure and overflow diagnostics
- lifecycle/resource management
- recursive watching within explicit finite bounds
- optional debounce/coalescing
- deterministic injected-source testing

Explicitly out of scope:

- synchronizing or copying files
- modifying watched targets
- executing commands or child processes
- network calls
- persistent databases/indexes
- cloud brokers
- telemetry uploads
- GUI/admin console
- content parsing of changed files

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
