# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **File Lease / Advisory Lock v0.1**.

## Current repository state

- Last released cube: **File Lease / Advisory Lock v0.1**
- Release PR: **#80**, merged
- Release commit: `b3d4f1dc61a6ed64d642fc0a9a92466c01da2868`
- Pre-merge verification: **Run 607**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, 522/522 full repository tests, and real-browser smoke.
- Post-merge verification: **Run 608**, passed on `main` across Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- File Lease / Advisory Lock v0.1 is **FROZEN**.
- The next cube candidate is **Ephemeral Workspace / Scratch Directory v0.1**. Its SPEC is the immediate next deliverable.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**EPHEMERAL-WORKSPACE-SCRATCH-DIRECTORY-V0.1-SPEC**

### Immediate next task

Write and commit the complete SPEC for **Ephemeral Workspace / Scratch Directory v0.1** before implementation begins.

The SPEC must lock:

1. standalone workspace lifecycle and public API
2. safe unique workspace creation without following attacker-controlled paths
3. bounded ownership metadata and workspace identity
4. cleanup and idempotent release behavior
5. optional TTL/expiry semantics without timestamp-only ownership claims
6. conservative stale/orphan recovery rules
7. path containment and symlink boundary behavior
8. deterministic test seams for filesystem, clock, and identity capabilities
9. cross-platform Ubuntu, Windows, macOS-15-Intel, and relevant WSL behavior
10. zero-runtime-third-party-dependency boundary

No implementation starts before the SPEC exists on the control plane.

## Scope lock

The next cube owns ephemeral workspace creation, identity, lifecycle, cleanup, and recovery. It does not own file watching, advisory locking, file synchronization, process execution, networking, persistence databases, or content parsing.

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
