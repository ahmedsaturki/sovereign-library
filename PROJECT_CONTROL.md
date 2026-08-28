# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

**Agent entry:** every autonomous agent must read `AGENTS.md` first, then this file. The permanent architecture contract is `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md`, and the project-wide knowledge map is `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md`.

## Current mission

**Phase 0 — First Public Package Batch / Authorized Publication Recovery** after freezing **Application Lifecycle / Graceful Shutdown Coordinator v0.1**.

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
- Human release authorization has been recorded for the two Phase-0 candidates; publication is currently **BLOCKED BY ENVIRONMENT PREREQUISITE** as recorded in `docs/release/AUTHORIZATION_PACKAGE_STATUS-V0.1.json`.

## Project-wide architecture law

The repository-wide independence and ecosystem model is governed by:

- `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md`
- `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md`
- `docs/SOVEREIGN_ECOSYSTEM_CONTRACT_V1.0.json`

The permanent principle is:

**INDEPENDENT CUBES -> EXPLICIT COMPOSITION -> REAL PRODUCTS**

A suitable Cube is intended to be independently usable, testable, packageable, distributable, versioned, secure, deterministic within contract, failure/recovery hardened, cross-platform where applicable, and replaceable without requiring the whole repository.

Sovereign is not Node-only. The ecosystem target is:

`ONE AUTHORITATIVE CONTRACT -> NATIVE IMPLEMENTATION PER ECOSYSTEM -> CONFORMANCE -> INDEPENDENT DISTRIBUTION`

Target ecosystems include Node.js/npm, Python/PyPI, Kotlin/Maven, Android, and future iOS/Apple distribution. Not every Cube must support every ecosystem; support is chosen by applicability and value.

An internal dependency is allowed only when it is explicit, versioned, resolvable in the distributed artifact, tested, and consistent with the Cube contract. Monorepo-relative runtime coupling must not leak into released packages.

## Recently implemented (feature branch, pre-release — NOT on main)

These are new, fully tested cubes/products built on the existing frozen foundation. They live on branch `feat/browser-interactions-assertions-webtestkit` under open PR #111. They are pre-release and are not frozen.

The branch's documented verification chain includes:

- `a3e3d20` — browser visual-testing diff correction + interaction `nth`/strict correction; CI #859 succeeded.
- `cb5b6ec` — recorder redaction hook; CI #860 succeeded.
- `2f4e75c` — recorder immutable snapshots + fail-closed redaction; CI #861 succeeded.
- `c4272f0` — control/doc reconciliation; CI #862 succeeded.
- `a495f1d` — release-wave preparation; CI #863 succeeded.
- `35c14dc` — release-candidate freeze-audit reconciliation; CI #866 succeeded.
- `1f61cd0` — human release authorization recorded; publication stopped cleanly at npm authentication/environment prerequisite; no publication occurred.

Browser-stack genuine defects fixed on this branch include:

- `browser-network-interception` corrected from the passive Network-domain approach to the real CDP Fetch-domain request interception/mocking flow, verified against real Chromium.
- `browser-visual-testing` deterministic multiset diff correction.
- `browser-interactions` `nth` + strict-mode correction.
- `browser-recorder` immutable-script hardening and caller-controlled fail-closed redaction.

These browser/Product components remain **NOT RELEASED** and **NOT FROZEN** until a later authorized release wave.

### Browser / Product components

- `cubes/browser-interactions` v0.1 — locators (`By.css/text/role/label/title/testId`), auto-wait, interaction actions, strict mode, deterministic errors.
- `cubes/browser-assertions` v0.1 — retry-classified assertions, snapshot Contract A exact normalized HTML-string comparison, documented canonicalization subset, soft-assertion lifecycle.
- `cubes/browser-recorder` v0.1 — record/replay, deeply immutable `getScript()`, caller-controlled record-time redaction, fail-closed `REDACT_ERROR`.
- `cubes/browser-network-interception` v0.1 — CDP Fetch-domain block/mock/pass-through control and deterministic traffic log; real response-body capture is intentionally out of v0.1 scope.
- `cubes/browser-tab-manager` v0.1 — multi-tab orchestration through CDP Target domain.
- `cubes/browser-visual-testing` v0.1 — DOM snapshot and deterministic diff.
- `products/web-test-kit` v0.1 — composable locate → act → assert → snapshot facade.
- `products/sovereign-automation` v0.1 — unified browser automation SDK/CLI composition.
- `storage` — clock capability injection hardening against global timer interference.

**Known frozen-cube test timing issue:** the frozen `application-lifecycle`, `atomic-batch-file-transaction`, and `process-supervisor` tests have documented load-sensitive timing behavior. They are not silently modified as part of browser/release work; remediation requires a dedicated authorized task.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless required for its gate.

## Current milestone

**LIBRARY DISTRIBUTION EXPANSION — ACTIVE (GitHub-only distribution)**

### Distribution policy

**GITHUB ONLY.** External registry publication (npm/PyPI/Maven Central) is deferred by explicit project decision. The first authorized batch (`@sovereign/safe-path-resolver`, `@sovereign/runtime-capability-inspector`) remains AUTHORIZED but GitHub-released is **not yet done**; npm publication is CLOSED permanently for this phase. Distribution channel = GitHub repo + Releases + artifacts + checksums. Every package remains a REAL standalone npm-compatible library (package.json/exports/types/files/license), consumable from GitHub without an external registry.

### Immediate next task

**INDEPENDENT LIBRARY PACKAGING WAVE (v15)** in progress. Turn every technically suitable Cube into a REAL standalone library; do NOT publish externally; accumulate release-ready packages; release through GitHub later.

**Phase-0 first batch (2 authorized candidates):** TECHNICALLY_READY / AUTHORIZED / NOT YET GITHUB-RELEASED.
- `@sovereign/safe-path-resolver` v0.1.0 — 11 exports
- `@sovereign/runtime-capability-inspector` v0.1.0 — 8 exports

**Packaging wave results so far (Node.js, publish-ready, GitHub distribution):**
- 7 packages staged in prior waves (incl. the 2 authorized) + 10 new this wave = **17 standalone packages, all TECHNICALLY_READY / PUBLICATION_DEFERRED**.
- New this wave (verified: declaration-exact, out-of-tree import, reproducible byte-identical tarballs):
  `@sovereign/canonical-json`(8), `digest`(14), `validation`(5), `result`(5), `url`(17),
  `cache`(4), `circuit-breaker`(3), `concurrency`(3), `diff-patch`(9), `event`(3),
  `logger`(7), `serialization`(10), `timeout-deadline`(8), `config`(10), `data`(11).
- Pipeline is now **data-driven**: `scripts/package-catalog.json` (single source of truth) + `scripts/package-stage.mjs` reads it; no per-Cube hardcoded switch.

**Remaining inventory (84 Cubes total):** 17 packaged; 21 classified PACKAGE-WORTHY-standalone (incl. the 10 new + others); 59 CONDITIONAL (browser/integration facades, or with relative monorepo imports requiring dependency-graph resolution before standalone packaging). NOT_PACKAGE_WORTHY = 0. Continue evaluating CONDITIONAL batch next.

No external publish. No guard bypassed. No token invented.

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
- `docs/release/RELEASE-RUNBOOK-V0.1.md`
- `docs/release/AUTHORIZATION_PACKAGE_STATUS-V0.1.json`

## Declaration strategy artifact

`docs/DECLARATION_STRATEGY_V0.1.md` is the governing decision record.

The repository remains JavaScript-first for its current Node implementation. Public declarations are produced incrementally from JSDoc with no TypeScript runtime dependency and no full source rewrite.

## Release sequence

Cube work follows:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Phase 0 readiness work is controlled by the same one-current-task discipline; it does not authorize parallel Cube implementation.

The public package release path is:

`READY -> EXPLICIT AUTHORIZATION -> FINAL CLEAN VERIFY -> TAG/RELEASE -> PUBLISH -> POST-PUBLISH VERIFY -> FREEZE`

## Definition of done

A Phase 0 task is DONE only when its decision artifact is reproducible, CI-verified, documented, and merged to `main` with the control plane advanced to exactly one next task.

A standalone Cube is not DONE for distribution merely because it exists in `cubes/`; its consumer artifact, dependency boundary, API, verification, and documentation must support independent use.

## Anti-loop rules

- Do not redesign the whole architecture during readiness or release work.
- Do not add dependencies merely to solve a local problem without a recorded decision.
- Do not start a second official Cube/readiness task while one is active.
- Do not turn a technically complete Cube into a public package without API/package/security/release gates.
- Do not call a package production-ready from source inspection alone.
- Do not treat CI success as publication authorization.
- Do not claim multi-language equivalence without conformance evidence.
- Do not make a Product dependency excuse hidden Cube coupling.
- Park out-of-scope work and continue the one official task.

## Recovery rule

If work is interrupted, read:

`AGENTS.md -> PROJECT_CONTROL.md -> ROADMAP.md -> latest Git state -> relevant SPEC`

Then resume from the listed immediate next task; do not restart from memory.