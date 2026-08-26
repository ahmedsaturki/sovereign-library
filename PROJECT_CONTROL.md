# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Safe File Quarantine / Delete v0.1**.

## Current repository state

- Latest released cube: **Safe File Quarantine / Delete v0.1**
- Release PR: **#100**, merged
- Release merge commit: `699d4181f0775af93b62d78f47fb00de42ec346e`
- Release-candidate head: `5cbfc565fbda6735c293f1c2d3c1309291a9a6d0`
- Final cross-platform verification: **Run #738**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs all green.
- Safe File Quarantine / Delete v0.1 is **FROZEN** at `699d4181f0775af93b62d78f47fb00de42ec346e`.
- Bounded File Content Reader / Safe Content Access v0.1 remains **FROZEN** at `f8db5a309aef655aec86051587bdf12d34f3dd20`.
- Filesystem Permission / Ownership Descriptor v0.1 remains **FROZEN** at `69028a66b3827ecfee4a70f2460998dd333f02e0`.
- Atomic Batch File Transaction / Safe Multi-File Commit v0.1 remains **FROZEN** at `1fae6399eb2710b53cc8f53878138ae9a24a241d`.
- File Lease / Advisory Lock v0.1 remains **FROZEN** with corrective hardening at `a2eb715a558d9c88f19e9ff83ff512971e548891`.
- Safe File Quarantine / Delete SPEC is **FROZEN** at `553037ba4d7090d65bd87151e53a7919b93ba84b`.
- No runtime third-party dependencies were added.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**NEXT-CUBE-SELECTION**

### Immediate next task

Inspect the repository's existing standalone product inventory, parked specs, roadmap, branch/PR history, and current architecture gaps; select the next standalone product supported by project evidence, then create and freeze its SPEC before implementation. Do not start implementation until the SPEC gate is explicitly recorded.

The Safe File Quarantine / Delete v0.1 release is complete and frozen after full cross-platform Run #738. No other cube may start concurrently.

## Previous release hardening lessons

- Run #722 correctly exposed a negative opaque ownership identifier that was not rejected; root cause was fixed at `2d099e5478d7a69aa34f4fde1279cee92f6aa55d`.
- Aggregate full-suite execution could hide a cross-platform hang. The release gate now uses `scripts/run-tests-bounded.mjs` so the same canonical test corpus is executed one file at a time with a 30-second per-file ceiling and an explicit failing-file identity.
- Native filesystem watcher smoke tests can race differently on macOS; the watcher release path now requires cleanup-safe smoke tests that do not assume a single first event shape. The PPO verification fix landed at `463f1c539124fb54c449d1c15283e329d031abdb`.
- The bounded content reader exposed a BOM edge case across collected and streaming text reads; the final release fixed duplicate BOM preservation and added regression coverage for BOM bytes split across stream chunk boundaries.
- Safe File Quarantine is intentionally quarantine-first: irreversible purge is only available from an exact, integrity-validated receipt, and cross-device moves fail closed instead of copying.

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
