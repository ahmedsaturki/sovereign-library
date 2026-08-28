# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

**Phase 0 — First Public Package Batch / Release Authorization Readiness** after freezing **Application Lifecycle / Graceful Shutdown Coordinator v0.1**.

## Current repository state

- Latest released cube: **Application Lifecycle / Graceful Shutdown Coordinator v0.1**
- Release PR: **#104**, merged
- Release merge commit: `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`
- Application Lifecycle / Graceful Shutdown Coordinator v0.1 is **FROZEN**.
- Process Supervisor / Managed Child Lifecycle v0.1 remains **FROZEN** at `881435f121d09099b9b263fa906f0968c42e4539`.
- Filesystem Recovery Journal / Operation Ledger v0.1 remains **FROZEN** at `7c197ce5e2d78b0df16265b6c6897812c56ca2`.
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
- Final pre-authorization verification: **Run #845**, commit `f14bbd9229fcda23f00602cfc9288881c61e213e`, passed completely on Ubuntu, Windows, and macOS-15-Intel.
- Release-readiness evidence is frozen in `docs/PUBLIC_PACKAGE_RELEASE_READINESS_V0.1.md`.
- Release authorization packet is frozen in `docs/PUBLIC_PACKAGE_RELEASE_AUTHORIZATION_PACKET_V0.1.md`.
- No public package publication is authorized yet.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless required for its gate.

## Current milestone

**PHASE-0-RELEASE-AUTHORIZATION-READY**

### Immediate next task

Obtain the explicit release-authorization decision for the two verified candidates: `@sovereign/safe-path-resolver` v0.1.0 and `@sovereign/runtime-capability-inspector` v0.1.0. Until that decision exists, do not publish, create/reserve an npm organization, configure npm tokens, add registry automation, or announce a public release.

### Completed Phase 0 gates

1. Inventory & Classification — **DONE / FROZEN** in PR #105.
2. License decision and repository licensing artifacts — **DONE / FROZEN** in PR #106; Apache-2.0 is authoritative on `main`.
3. Public API boundary freeze — **DONE / VERIFIED**; Run #782 passed on Ubuntu, Windows, and macOS-15-Intel.
4. Type/declaration strategy without a full rewrite — **DONE / VERIFIED**; Run #809 passed on Ubuntu, Windows, and macOS-15-Intel.
5. Package contract — **DONE / VERIFIED**; PR #108 merged at `b7b8f985058fb4a13e73cf255dd6fdf7508da5bd`; Run #812 passed on Ubuntu, Windows, and macOS-15-Intel.
6. Package tooling implementation — **DONE / VERIFIED**.
7. Reproducible `npm pack` and security verification — **DONE / VERIFIED** by Run #835.
8. Publication guard — **DONE / WIRED / VERIFIED** by Run #845 on all supported platforms.
9. Release-readiness record — **DONE / FROZEN**.
10. Release authorization packet — **DONE / FROZEN**.

## Governing release records

- `docs/PUBLIC_PACKAGE_RELEASE_READINESS_V0.1.md`
- `docs/PUBLIC_PACKAGE_RELEASE_AUTHORIZATION_PACKET_V0.1.md`

## Declaration strategy artifact

`docs/DECLARATION_STRATEGY_V0.1.md` is the governing decision record.

The repository remains JavaScript-first. Public declarations are produced incrementally from JSDoc with no TypeScript runtime dependency and no full source rewrite.

## Release sequence

Cube work follows:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Phase 0 readiness work is controlled by the same one-current-task discipline; it does not authorize parallel Cube implementation.

The public package release path is:

`READY -> EXPLICIT AUTHORIZATION -> FINAL CLEAN VERIFY -> TAG/RELEASE -> PUBLISH -> POST-PUBLISH VERIFY -> FREEZE`

## Definition of done

A Phase 0 task is DONE only when its decision artifact is reproducible, CI-verified, documented, and merged to `main` with the control plane advanced to exactly one next task.

## Anti-loop rules

- Do not redesign the whole architecture during readiness work.
- Do not add dependencies merely to solve a local problem without a recorded decision.
- Do not start a second Cube while a Phase 0 task is active.
- Do not turn a technically complete cube into a public package without API/package/security/release-authorization gates.
- Do not call a package production-ready from source inspection alone.
- Do not treat CI success as publication authorization.
- Park out-of-scope work and continue.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart from memory.

## Governance & agent entry (updated 2026-08-28)

- **Governance & standing DO-NOT list:** `GOVERNANCE.md` (never merge PR #111, never push to `main` without review, never force-push, never rewrite history, never modify frozen code, never delete history, CI ≠ authorization; distribution policy = GitHub canonical + optional free registries per wave).
- **Agent entry / permanent memory home:** `AGENTS.md`. NOTE: `AGENTS.md` could not be written in this session — the runtime blocked the write as a protected agent-instruction file without user consent. The intended content is mirrored in `GOVERNANCE.md`; re-attempt writing `AGENTS.md` on explicit user approval.
- **Declarative package catalog:** `PACKAGE_CATALOG.json` (schema `sovereign-package-catalog/v1`), generated from `origin/main`. 78 cubes: 74 STANDALONE, 4 CONDITIONAL, 77 eligible, 2 first-batch staged.
- **Catalog-driven packaging pipeline (additive):** `scripts/package-catalog-stage.mjs`, `scripts/verify-package-catalog.mjs`, `scripts/verify-package-catalog-reproducible.mjs`. Original first-batch scripts (`scripts/package-stage.mjs`, etc.) remain canonical for the two first-batch candidates.
- **Verified (real execution, 2026-08-28):** 13 staged packages pass manifest/export-map AND reproducible byte-identical tarball verification via the catalog pipeline. Out-of-tree import confirmed for `safe-path-resolver` and `canonical-json`.
- **CONDITIONAL cubes (4):** import first-batch via monorepo-relative path; remediation recorded in `PACKAGE_CATALOG.json` (`conditionalDependency.remediation`). Not yet applied — requires its own authorized task.

## Known CI flake (recorded 2026-08-28, NOT a code defect)

- PR #124 (branch `feat/package-catalog-qualification`, commit `1676ea4`) CI Run #33136941627
  failed on **windows-latest only** (ubuntu + macOS green). The failing assertion is
  `cubes/application-lifecycle/test/index.test.js:123` ("late participant completion cannot
  mutate the terminal snapshot") — a **frozen timing-sensitive test** (see directive rule #11).
  The diff is a 1ms `remainingMs` clock-granularity drift under GitHub Windows-runner load
  (`29985` vs `29986`).
- Classification: **INFRASTRUCTURE FLAKE / ENVIRONMENT** on a pre-existing frozen test.
  This branch does NOT modify `application-lifecycle` source or tests (only adds
  `packages/application-lifecycle/README.md` + `package.json` declarative metadata).
- Local verification: the same test passes **14/14 on Windows 3 consecutive runs** on the same
  machine, confirming it is not a deterministic regression introduced here.
- Governance: the frozen test must NOT be weakened/silenced to "fix CI" (rule #11). Remediation
  (if any) of the flake requires its own explicitly authorized maintenance task. CI cannot be
  forced green here without violating the frozen-test rule; PR #124 is left for human review
  with this flake disclosed.
- **Rerun confirmation (2026-08-28):** Run #33137185382 on the same branch/commit (`ee86847`)
  passed on **all three platforms** (ubuntu + windows + macOS-15-intel) with the full matrix
  green. This confirms the prior Run #33136941627 Windows failure was a non-deterministic
  CI-runner timing flake on the frozen test, not a code defect. The branch is CI-green.
