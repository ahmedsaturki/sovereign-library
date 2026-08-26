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
- The Atomic Batch hardening closed absolute-root enforcement, proof-gated `strong-local` capability claims, truthful post-cleanup rollback availability, immutable ABT1 receipts, bounded planning, and fail-closed recovery.
- No runtime third-party dependencies were added.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**FILESYSTEM-PERMISSION-OWNERSHIP-DESCRIPTOR-SPEC**

### Immediate next task

Implement **Filesystem Permission / Ownership Descriptor v0.1** from the frozen SPEC at `specs/filesystem-permission-ownership-descriptor-v0.1.md` (SPEC commit `fc5bbf3c8c9125699c3a0e2b5c2fc817592e24d5`). The implementation must remain standalone and dependency-free, preserve the non-mutating default, keep platform capabilities explicit, and enter the normal `IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE` sequence.

The SPEC gate is complete. No other cube may start concurrently.

## Scope lock

The active cube is limited to normalized permission/ownership descriptors, capability detection, privacy-safe identifiers, deterministic immutable serialization, bounded metadata collection, explicit unsupported-platform behavior, capability/data separation, and failure/cancellation semantics.

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
