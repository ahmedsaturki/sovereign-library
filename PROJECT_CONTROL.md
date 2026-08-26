# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

**Phase 0 — Stabilization & Package Readiness** after freezing **Application Lifecycle / Graceful Shutdown Coordinator v0.1**.

## Current repository state

- Latest released cube: **Application Lifecycle / Graceful Shutdown Coordinator v0.1**
- Release PR: **#104**, merged
- Release merge commit: `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`
- Final pre-merge verification: **Run #768**, passed on Ubuntu, Windows, and macOS-15-Intel.
- Post-merge mainline verification: **Run #772**, passed on Ubuntu, Windows, and macOS-15-Intel.
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
- No public package publication is authorized yet.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless required for its gate.

## Current milestone

**PHASE-0-STABILIZATION-DECLARATION-STRATEGY**

### Immediate next task

Pilot and verify TypeScript declaration generation for the first two public API candidates using the JSDoc-first strategy. Do not add package-specific `package.json` files, changesets, API Extractor configuration, or publish packages until the declaration gate passes.

### Completed Phase 0 gates

1. Inventory & Classification — **DONE / FROZEN** in PR #105.
2. License decision and repository licensing artifacts — **DONE / FROZEN** in PR #106; Apache-2.0 is authoritative on `main`.
3. Public API boundary freeze — **DONE / VERIFIED**; Run #782 passed on Ubuntu, Windows, and macOS-15-Intel, with eight candidate APIs documented in `docs/PUBLIC_API_BOUNDARY_V0.1.md`.

### Phase 0 order after declaration strategy

4. Type/declaration strategy without a full rewrite — **ACTIVE**
5. Package contract/tooling (`package.json`, exports, changesets, API extraction)
6. Reproducible `npm pack` and security verification
7. First small public package batch

## Declaration strategy artifact

`docs/DECLARATION_STRATEGY_V0.1.md` is the governing decision record.

The repository remains JavaScript-first. Public declarations are produced incrementally from JSDoc with no TypeScript runtime dependency and no full source rewrite.

Initial pilot candidates:

1. Safe Path Resolver / Containment Boundary
2. Runtime Capability Inspector

The declaration compiler contract is `jsconfig.declarations.json` and emits only into the ignored `.artifacts/declarations` staging directory.

The declaration CI gate is a dedicated job inside `.github/workflows/verify.yml`. It runs with pinned build-time tooling only; these tools are not runtime dependencies of any Cube.

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
- Do not turn a technically complete cube into a public package without API/package/security gates.
- Do not call a package production-ready from source inspection alone.
- Park out-of-scope work and continue.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart from memory.
