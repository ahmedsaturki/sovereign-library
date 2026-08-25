# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Freeze the released **Artifact Release Publication Confirmation / Outcome Receipt Cube v0.1** and perform the controlled **NEXT CUBE** selection step. No new implementation begins until the next cube is explicitly defined in the control plane.

## Current repository state

- Last released cube: **Artifact Release Publication Confirmation / Outcome Receipt v0.1**
- Release PR: **#77**, squash-merged
- Release commit: `ee642ac4f760da6ee6263faa5e82bf7d197fa78d`
- Pre-merge verification: **Run 573**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke after the final regression-fixture correction.
- Post-merge verification: **Run 574**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Release Publication Confirmation / Outcome Receipt v0.1 is therefore **FROZEN**.
- The released cube provides exact five-field closure identity linkage, deterministic plan/outcome linkage, bounded immutable confirmations, caller-supplied evidence and timestamps, optional bounded metadata, strict fail-closed validation, SPC1 checksum-protected serialization, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**NEXT-CUBE-SELECTION**

### Immediate next task

Select and record exactly one next standalone Sovereign cube from the repository's parked work or a newly justified gap, then write its SPEC before implementation begins.

Selection must preserve the project constraints:

1. standalone product boundary
2. zero runtime third-party dependencies where practical
3. explicit public contract and failure model
4. cross-platform support and verification
5. documentation, runnable example, and tests
6. no overlap with already released cubes
7. no unrelated architecture expansion

Until that selection and SPEC exist, do not start implementation of another cube.

## Scope lock

The previously active Artifact Release Publication Confirmation / Outcome Receipt v0.1 scope is closed and frozen. No additional feature work may be added to that cube outside a separately authorized future version.

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
