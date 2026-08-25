# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Bounded File Content Reader / Safe Content Access v0.1**.

## Current repository state

- Last released cube: **Bounded File Content Reader / Safe Content Access v0.1**
- Release PR: **#94**, merged
- Release commit: `277cb8f4d1e8278fe31c8dc7d3269c5c9bbeee99`
- Exact-SHA verification: final Reader verification passed with syntax, 400+ full-suite tests, 14+ Reader-specific tests, and browser smoke before release.
- Pre-merge verification: **Run 693**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, **661/661 tests**, and real-browser smoke.
- Mainline release verification: **Run 694**, passed on the release commit.
- Mainline verification record: **Run 695**, Push verification on `main`; Ubuntu and Windows passed. The macOS-15-Intel job had a transient Node.js test-runner hang on specific runner instances: the original job and first two reruns timed out after the test suite itself passed, while a third fresh-run attempt **Job 98006586509** completed successfully in **34s** with syntax, contract/integration tests, browser smoke, and complete job all passing. No product code or `verify.yml` changes were required.
- Bounded File Content Reader / Safe Content Access v0.1 is **FROZEN** at `277cb8f4d1e8278fe31c8dc7d3269c5c9bbeee99`.
- Blocking fixes discovered during Run 687–693 included the test-harness syntax defect, BOM preservation, Safe Path Resolver error mapping, privacy-safe diagnostics, and the correct work-budget boundary. Each produced a minimal fix and regression coverage.
- No runtime third-party dependencies were added.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**FILESYSTEM-LEASE-AND-LOCK-REVIEW**

### Immediate next task

Review the already-released **File Lease / Advisory Lock v0.1** against the lessons learned from Safe Path, Metadata, Directory Walker, and Reader before selecting the next new cube. Verify that its current public contract, recovery semantics, cross-platform behavior, and documentation still meet the current Sovereign release bar. If gaps are found, create a scoped corrective task; otherwise select and SPEC the next unreleased standalone cube.

No new cube implementation starts before this review gate is complete.

## Scope lock

The review must not redesign the architecture or reopen unrelated cubes. It is limited to the released File Lease / Advisory Lock contract, its tests, recovery behavior, portability, and documentation, plus selecting the next unreleased cube once the review is closed.

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
