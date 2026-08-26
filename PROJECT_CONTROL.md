# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select the next standalone Sovereign product after freezing **Application Lifecycle / Graceful Shutdown Coordinator v0.1**.

## Current repository state

- Latest released cube: **Application Lifecycle / Graceful Shutdown Coordinator v0.1**
- Release PR: **#104**, merged
- Release merge commit: `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`
- Final pre-merge verification: **Run #768**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs all green.
- Application Lifecycle / Graceful Shutdown Coordinator v0.1 is **FROZEN** at `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4` pending post-merge mainline verification.
- Process Supervisor / Managed Child Lifecycle v0.1 remains **FROZEN** at `881435f121d09099b9b263fa906f0968c42e4539`.
- Filesystem Recovery Journal / Operation Ledger v0.1 remains **FROZEN** at `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`.
- Safe File Quarantine / Delete v0.1 remains **FROZEN** at `699d4181f0775af93b62d78f47fb00de42ec346e`.
- Bounded File Content Reader / Safe Content Access v0.1 remains **FROZEN** at `f8db5a309aef655aec86051587bdf12d34f3dd20`.
- Filesystem Permission / Ownership Descriptor v0.1 remains **FROZEN** at `69028a66b3827ecfee4a70f2460998dd333f02e0`.
- Atomic Batch File Transaction / Safe Multi-File Commit v0.1 remains **FROZEN** at `1fae6399eb2710b53cc8f53878138ae9a24a241d`.
- File Lease / Advisory Lock v0.1 remains **FROZEN** with corrective hardening at `a2eb715a558d9c88f19e9ff83ff512971e548891`.
- No runtime third-party dependencies were added for Release #104.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**NEXT-CUBE-SELECTION**

### Immediate next task

Inspect the current standalone-product inventory, parked specs, roadmap, branches, open PRs/issues, and existing implementations; choose one non-duplicative next Cube supported by repository evidence; freeze its SPEC before implementation.

No implementation of another Cube may begin until the next SPEC gate is recorded.

### Completed Release #104

Application Lifecycle / Graceful Shutdown Coordinator v0.1 was released through:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE`

Run #768 passed on Ubuntu, Windows, and macOS-15-Intel. The cube now provides deterministic participant registration and ordering, explicit application lifecycle state, one global shutdown transaction, global deadline with bounded participant timeouts, concurrent/idempotent shutdown, cancellation, stale/late completion isolation, bounded outcomes/diagnostics, immutable snapshots/errors, capability/data separation, and zero runtime third-party dependencies.

## Previous release hardening lessons

- Run #722 correctly exposed a negative opaque ownership identifier that was not rejected; root cause was fixed at `2d099e5478d7a69aa34f4fde1279cee92f6aa55d`.
- Aggregate full-suite execution could hide a cross-platform hang. The release gate uses `scripts/run-tests-bounded.mjs` so the canonical test corpus is executed one file at a time with a 30-second per-file ceiling and explicit failing-file identity.
- Native filesystem watcher smoke tests can race differently on macOS; cleanup-safe smoke semantics are required.
- The bounded content reader exposed a BOM edge case across collected and streaming reads; duplicate BOM preservation and split-chunk coverage were added before release.
- Safe File Quarantine is intentionally quarantine-first: irreversible purge requires an exact integrity-validated receipt, and cross-device moves fail closed instead of copying.
- Recovery Journal explicitly records intent/evidence but never performs implicit replay; recovery decision remains separate from privileged mutation.
- Process Supervisor CI exposed a capability/data boundary issue around `AbortSignal`; the final implementation keeps executable signal capabilities separate from plain-data validation and normalizes public operation errors to asynchronous Promise rejections.
- Application Lifecycle CI exposed an overly broad test fixture assumption around global and participant timeout budgets; the release kept the configuration invariant strict and aligned fixtures with the frozen contract.

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
