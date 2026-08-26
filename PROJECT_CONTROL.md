# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Release **Filesystem Recovery Journal / Operation Ledger v0.1** as the next standalone Sovereign product after freezing **Safe File Quarantine / Delete v0.1**.

## Current repository state

- Latest released cube: **Safe File Quarantine / Delete v0.1**
- Release PR: **#100**, merged
- Release merge commit: `699d4181f0775af93b62d78f47fb00de42ec346e`
- Final pre-merge verification: **Run #738**, passed on Ubuntu, Windows, and macOS-15-Intel.
- Safe File Quarantine / Delete v0.1 is **FROZEN** at `699d4181f0775af93b62d78f47fb00de42ec346e`.
- Bounded File Content Reader / Safe Content Access v0.1 remains **FROZEN** at `f8db5a309aef655aec86051587bdf12d34f3dd20`.
- Filesystem Permission / Ownership Descriptor v0.1 remains **FROZEN** at `69028a66b3827ecfee4a70f2460998dd333f02e0`.
- Atomic Batch File Transaction / Safe Multi-File Commit v0.1 remains **FROZEN** at `1fae6399eb2710b53cc8f53878138ae9a24a241d`.
- File Lease / Advisory Lock v0.1 remains **FROZEN** with corrective hardening at `a2eb715a558d9c88f19e9ff83ff512971e548891`.
- Safe File Quarantine / Delete SPEC is **FROZEN** at `553037ba4d7090d65bd87151e53a7919b93ba84b`.
- Filesystem Recovery Journal SPEC is **FROZEN** on the active feature branch at commit `122d85d5bb9b97d5e67d496a40e1a055d9531e44`.
- Post-merge **Run #739** and control-plane **Run #740** both passed on Ubuntu, Windows, and macOS-15-Intel.
- No runtime third-party dependencies were added.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**FILESYSTEM-RECOVERY-JOURNAL-IMPLEMENT**

### Immediate next task

Implement the frozen Filesystem Recovery Journal / Operation Ledger v0.1 SPEC, add standalone documentation/example and package/test-gate registration, then enter `TEST -> FIX -> VERIFY` on the supported platform matrix. Do not start another cube concurrently.

### Scope lock

The active cube is limited to explicit bounded operation journaling, deterministic sequence ordering, lifecycle transitions, integrity-protected FRJ1 envelopes, interrupted-operation inspection, explicit recovery decisions, persistence failure semantics, immutable snapshots, privacy-safe diagnostics, capability/data separation, cancellation semantics, and zero runtime third-party dependencies. Recovery inspection never executes filesystem mutations.

## Previous release hardening lessons

- Run #722 correctly exposed a negative opaque ownership identifier that was not rejected; root cause was fixed at `2d099e5478d7a69aa34f4fde1279cee92f6aa55d`.
- Aggregate full-suite execution could hide a cross-platform hang. The release gate now uses `scripts/run-tests-bounded.mjs` so the same canonical test corpus is executed one file at a time with a 30-second per-file ceiling and an explicit failing-file identity.
- Native filesystem watcher smoke tests can race differently on macOS; the watcher release path now requires cleanup-safe smoke tests that do not assume a single first event shape.
- The bounded content reader exposed a BOM edge case across collected and streaming text reads; the final release fixed duplicate BOM preservation and added regression coverage for BOM bytes split across stream chunk boundaries.
- Safe File Quarantine is intentionally quarantine-first: irreversible purge is only available from an exact, integrity-validated receipt, and cross-device moves fail closed instead of copying.
- Recovery Journal explicitly records intent/evidence but never performs implicit replay; this separates recovery decision from privileged mutation and avoids hidden side effects.

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
