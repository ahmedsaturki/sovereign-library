# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Atomic Batch File Transaction / Safe Multi-File Commit v0.1**.

## Current repository state

- Latest released cube: **Atomic Batch File Transaction / Safe Multi-File Commit v0.1**
- Release PR: **#96**, merged
- Release commit: `1fae6399eb2710b53cc8f53878138ae9a24a241d`
- Pre-merge verification: **Run #710**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax, full tests, browser smoke, and complete jobs all green.
- Mainline Push verification: **Run #712**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax, full tests, browser smoke, and complete jobs all green.
- Atomic Batch File Transaction / Safe Multi-File Commit v0.1 is **FROZEN** at `1fae6399eb2710b53cc8f53878138ae9a24a241d`.
- File Lease / Advisory Lock v0.1 remains **FROZEN** with corrective hardening at `a2eb715a558d9c88f19e9ff83ff512971e548891`.
- The Atomic Batch hardening closed: absolute-root enforcement, proof-gated `strong-local` atomicity, truthful post-cleanup rollback availability, immutable ABT1 receipts, bounded planning, and fail-closed recovery.
- No runtime third-party dependencies were added.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**FILESYSTEM-PERMISSION-OWNERSHIP-DESCRIPTOR-SPEC**

### Immediate next task

Write and freeze the SPEC for **Filesystem Permission / Ownership Descriptor v0.1** as a standalone dependency-free cube. The SPEC must define normalized cross-platform permission/ownership metadata, capability detection, safe non-mutating inspection by default, explicit mutation opt-in boundaries if supported, privacy-safe identifiers, deterministic serialization, unsupported-platform behavior, bounded work, capability/data separation, failure/recovery semantics, and zero runtime third-party dependencies.

No implementation starts until the SPEC is committed and the SPEC gate is recorded in this control plane.

## Scope lock

Do not redesign the architecture or reopen frozen cubes. The active milestone is limited to the permission/ownership descriptor contract, portability, capability seams, documentation, tests, and release state.

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
