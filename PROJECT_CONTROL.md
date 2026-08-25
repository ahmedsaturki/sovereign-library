# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Runtime Capability Inspector v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Release Publication Confirmation / Outcome Receipt v0.1**
- Release PR: **#77**, squash-merged
- Release commit: `ee642ac4f760da6ee6263faa5e82bf7d197fa78d`
- Pre-merge verification: **Run 573**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 574**, passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.
- Artifact Release Publication Confirmation / Outcome Receipt v0.1 is **FROZEN**.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**RUNTIME-CAPABILITY-INSPECTOR-V0.1-SPEC**

### Immediate next task

Implement the public contract defined in `specs/runtime-capability-inspector-v0.1.md`:

1. capture bounded host/runtime facts without leaking environment values
2. inspect explicit executable availability without executing programs
3. normalize an immutable capability snapshot
4. evaluate declarative runtime requirements with deterministic ordered findings
5. reject unsafe/accessor/circular/oversized inputs fail-closed
6. serialize and parse reports with deterministic `RCI1` integrity protection
7. provide recovery after rejected input without global state poisoning
8. remain zero-runtime-third-party-dependency and cross-platform
9. add normal, failure, recovery, requirement, serialization, and idempotency tests
10. add README, changelog, runnable example, package registration, and release verification

## Scope lock

Allowed scope for Runtime Capability Inspector v0.1:

- local runtime and host observation
- bounded executable availability checks based on filesystem metadata
- pure requirement evaluation
- immutable normalized reports
- typed fail-closed validation
- deterministic checksum-protected serialization
- unit/contract/failure/recovery/idempotency/cross-platform verification

Explicitly out of scope:

- executing commands or child processes
- installing or downloading software
- network calls
- credentials and secret values
- persistent configuration mutation
- scheduling or orchestration
- telemetry collection
- GUI/admin console

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
