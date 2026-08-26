# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

**Phase 0 — Stabilization & Package Readiness** after freezing **Application Lifecycle / Graceful Shutdown Coordinator v0.1**.

## Current repository state

- Latest released cube: **Application Lifecycle / Graceful Shutdown Coordinator v0.1**
- Release PR: **#104**, merged
- Release merge commit: `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`
- Application Lifecycle / Graceful Shutdown Coordinator v0.1 is **FROZEN**.
- Process Supervisor / Managed Child Lifecycle v0.1 remains **FROZEN** at `881435f121d09099b9b263fa906f0968c42e4539`.
- Filesystem Recovery Journal / Operation Ledger v0.1 remains **FROZEN** at `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`.
- Safe File Quarantine / Delete v0.1 remains **FROZEN** at `699d4181f0775af93b62d78f47fb00de42ec346e`.
- Bounded File Content Reader / Safe Content Access v0.1 remains **FROZEN** at `f8db5a309aef655aec86051587bdf12d34f3dd20`.
- Filesystem Permission / Ownership Descriptor v0.1 remains **FROZEN** at `69028a66b3827ecfee4a70f2460998dd333f02e0`.
- Atomic Batch File Transaction / Safe Multi-File Commit v0.1 remains **FROZEN** at `1fae6399eb2710b53cc8f53878138ae9a24a241d`.
- File Lease / Advisory Lock v0.1 remains **FROZEN** with corrective hardening at `a2eb715a558d9c88f19e9ff83ff512971e548891`.
- License decision: **Apache License 2.0**, merged by PR #106 at `37bdac72bd86c3a190035f3a36a2cfe497fe2812`.
- API boundary verification: **Run #782**, passed on Ubuntu, Windows, and macOS-15-Intel.
- Declaration pilot verification: **Run #809**, passed on Ubuntu, Windows, and macOS-15-Intel, including exact public-surface matching for the first two pilot candidates.
- Package contract: **DONE / VERIFIED**, merged by PR #108 at `b7b8f985058fb4a13e73cf255dd6fdf7508da5bd`; verification **Run #812** passed on Ubuntu, Windows, and macOS-15-Intel.
- Package tooling, reproducibility, and security verification: **DONE / VERIFIED** by **Run #835**, passed on Ubuntu, Windows, and macOS-15-Intel.
- Publication guard implementation: merged in commit `91ff69c40c72b62e97d6e1e07a83f87397acacdc` and wired into CI at `9e2ca35668e5ad2923a8c6c6c4992483a07b181d`.
- Latest publication-guard verification: **Run #837**, Ubuntu has passed the complete matrix; Windows and macOS are still completing the matrix at the time of this control update.
- No public package publication is authorized yet.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless required for its gate.

## Current milestone

**PHASE-0-FIRST-PUBLIC-PACKAGE-BATCH**

### Immediate next task

Complete the first small public package batch release-preparation gate for `@sovereign/safe-path-resolver` and `@sovereign/runtime-capability-inspector`: finish the publication-guard matrix on all supported platforms, freeze the release-readiness record, and prepare a release authorization packet. Do **not** publish, create/reserve an npm organization, configure npm tokens, or add registry automation until the release authorization gate is explicitly satisfied.

### Completed Phase 0 gates

1. Inventory & Classification — **DONE / FROZEN** in PR #105.
2. License decision and repository licensing artifacts — **DONE / FROZEN** in PR #106; Apache-2.0 is authoritative on `main`.
3. Public API boundary freeze — **DONE / VERIFIED**; Run #782 passed on Ubuntu, Windows, and macOS-15-Intel.
4. Type/declaration strategy without a full rewrite — **DONE / VERIFIED**; Run #809 passed on Ubuntu, Windows, and macOS-15-Intel.
5. Package contract — **DONE / VERIFIED**; PR #108 merged at `b7b8f985058fb4a13e73cf255dd6fdf7508da5bd`; Run #812 passed on Ubuntu, Windows, and macOS-15-Intel.
6. Package tooling implementation — **DONE / VERIFIED**.
7. Reproducible `npm pack` and security verification — **DONE / VERIFIED** by Run #835.
8. Publication guard implementation — **DONE / WIRED**, cross-platform final verification pending Run #837 completion.

## Governing release record

`docs/PUBLIC_PACKAGE_RELEASE_READINESS_V0.1.md` is the current release-readiness record for the first two public package candidates.

## Declaration strategy artifact

`docs/DECLARATION_STRATEGY_V0.1.md` is the governing decision record.

The repository remains JavaScript-first. Public declarations are produced incrementally from JSDoc with no TypeScript runtime dependency and no full source rewrite.

## Release sequence

Cube work follows:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Phase 0 readiness work is controlled by the same one-current-task discipline; it does not authorize parallel Cube implementation.

## Definition of done

A Phase 0 task is DONE only when its decision artifact is reproducible, CI-verified, documented, and merged to `main` with the control plane advanced to exactly one next task.

## Anti-loop rules

- Do not redesign the whole architecture during readiness work.
- Do not add dependencies merely to solve a local problem without a recorded decision.
- Do not start a second Cube while a Phase 0 task is active.
- Do not turn a technically complete cube into a public package without API/package/security/release-authorization gates.
- Do not call a package production-ready from source inspection alone.
- Park out-of-scope work and continue.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart from memory.
