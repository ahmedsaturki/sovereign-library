# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Filesystem Permission / Ownership Descriptor v0.1**.

## Current repository state

- Latest released cube: **Filesystem Permission / Ownership Descriptor v0.1**
- Release PR: **#98**, merged
- Release merge commit: `69028a66b3827ecfee4a70f2460998dd333f02e0`
- Release-candidate head: `463f1c539124fb54c449d1c15283e329d031abdb`
- Final cross-platform verification: **Run #727**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs all green.
- Filesystem Permission / Ownership Descriptor v0.1 is **FROZEN** at release merge commit `69028a66b3827ecfee4a70f2460998dd333f02e0`.
- Atomic Batch File Transaction / Safe Multi-File Commit v0.1 remains **FROZEN** at `1fae6399eb2710b53cc8f53878138ae9a24a241d`.
- File Lease / Advisory Lock v0.1 remains **FROZEN** with corrective hardening at `a2eb715a558d9c88f19e9ff83ff512971e548891`.
- No runtime third-party dependencies were added.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**BOUNDED-FILE-CONTENT-READER-SAFE-CONTENT-ACCESS-SPEC**

### Immediate next task

Read and freeze the existing **Bounded File Content Reader / Safe Content Access v0.1** SPEC, then implement from that SPEC without restarting or duplicating prior work. The cube must remain standalone and dependency-free at runtime, preserve non-mutating behavior, use explicit filesystem capability seams, enforce bounded reads/chunks/bytes, provide strict text decoding policies, support cancellation/deadline and handle cleanup, document symlink/changing-file policies, and enter the normal `SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE` sequence.

Existing work in PR #94 is an implementation candidate from an earlier project state; do not assume it is release-ready. First compare the frozen/current SPEC with the existing implementation and tests, identify any drift, then continue with the smallest compliant delta.

The SPEC gate for the new cube is the only active milestone. No other cube may start concurrently.

## Previous release hardening lessons

- Run #722 correctly exposed a negative opaque ownership identifier that was not rejected; root cause was fixed at `2d099e5478d7a69aa34f4fde1279cee92f6aa55d`.
- Aggregate full-suite execution could hide a cross-platform hang. The release gate now uses `scripts/run-tests-bounded.mjs` so the same canonical test corpus is executed one file at a time with a 30-second per-file ceiling and an explicit failing-file identity.
- Native filesystem watcher smoke tests can race differently on macOS; the watcher release path now requires cleanup-safe smoke tests that do not assume a single first event shape. The PPO verification fix landed at `463f1c539124fb54c449d1c15283e329d031abdb`.

## Scope lock

The active cube is limited to bounded file content access, binary/text reads, offsets/EOF, strict UTF-8/BOM/newline policies, chunked streaming, cancellation/deadline, changing-file and symlink policies, Safe Path Resolver anchoring, capability/data separation, deterministic serialization where required by the SPEC, and failure/recovery semantics.

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
