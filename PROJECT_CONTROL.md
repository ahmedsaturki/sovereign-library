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

## Recently implemented (feature branch, pre-release, CI-pending — NOT on main)

These are new, fully unit-tested cubes/products built on the existing frozen
foundation. They live on branch `feat/browser-interactions-assertions-webtestkit`
under open PR #111 (unmerged). They follow SPEC → IMPLEMENT → TEST and pass the
bounded test runner; PR #111 CI history (by commit): `f34b724` #853 succeeded,
`55ca514` #854 failed on Windows (hardcoded `/tmp` in a product test, corrected),
`3e5a56b` #855 succeeded (Windows fix verified), `017aefb`/`a522746` #856/#857
cancelled then re-run to **#857 succeeded** on all three platforms (Ubuntu /
Windows / macOS-15-Intel); a later v6 doc/contract-drift reconciliation commit
`67204b6` ran as **#858 succeeded** on all three platforms and was the then-current
PR head. Subsequent v7/v8/v9/v10 passes advanced the branch: `a3e3d20` (#859
succeeded), `cb5b6ec` (#860 succeeded, recorder sensitive-data redact hook), and
`2f4e75c` (#861 succeeded, recorder immutable-snapshot + fail-closed redaction
hardening; **current PR head**). Browser-stack genuine defects fixed on this branch
(visual-testing diff multiset fix, interactions `nth`+strict-mode fix, recorder
immutable-snapshot aliasing + redactor fail-closed) with regression tests added.
They are **NOT yet released or frozen**; they are
staged for the next release wave after the Phase 0
authorization gate. None of this work is in conflict with the one-current-task rule
because it is parked, not active, and does not touch main.

- `cubes/browser-interactions` v0.1 — locators (`By.css/text/role/label/title/testId`), auto-wait (`waitFor`/`waitForVisible`), input simulation (`click`/`fill`/`press`/`focus`/`clear`), strict mode, deterministic error taxonomy. Unit-tested with a fake session, no browser required.
- `cubes/browser-assertions` v0.1 — auto-retrying `expect(locator)` assertions (`toBeVisible`/`toBeEnabled`/`toHaveText`/...) with retry classification (`retryable` respected; non-retryable + unexpected errors surface immediately), `Snapshot.capture`/`diff` exact normalized HTML-string comparison (Contract A). Canonicalization is a **documented subset** of the Sovereign `canonical-json` cube inlined for package independence — it faithfully preserves every guarantee reachable through the `{ html: string }` snapshot input (key-sorted output, finite-number rejection, `-0`, plain-object rule, accessor rejection, circular detection, bounded recursion). It is NOT the full canonical-json cube (no tunable limits/config), and the code/SPEC/tests say so explicitly. Soft-assertion lifecycle (`softErrors`/`clearSoftErrors`), deterministic error taxonomy.
- `cubes/browser-recorder` v0.1 — record/replay of interaction sequences; `getScript()` returns deeply-frozen immutable snapshots (no internal-state aliasing); opt-in caller-controlled `redact` hook (record-time only, fail-closed `REDACT_ERROR`, no automatic secret detection).
- `cubes/browser-network-interception` v0.1 — request/response interception, mocking, request log.
- `cubes/browser-tab-manager` v0.1 — multi-tab orchestration via CDP Target domain, immutable `list()`.
- `cubes/browser-visual-testing` v0.1 — DOM snapshot capture + deterministic diff.
- `products/web-test-kit` v0.1 — composable product façade over `browser` + interaction/assertion cubes; one import runs a full locate→act→assert→snapshot flow. Zero third-party dependencies.
- `products/sovereign-automation` v0.1 — unified SDK + CLI (`bin/cli.js`) composing all browser cubes; 5/5 product tests pass locally. Zero third-party dependencies.
- `storage` cube hardened with clock capability injection (fixed a global-timer interference bug that broke the full-suite TTL test; now isolated and deterministic).

> NOTE: The canonical `scripts.test` on `main` tracks released cubes only. The
> feature-branch working tree also carries additional browser-cube and product test
> files that are NOT yet in `main`'s list. As of the v3 correction pass the feature
> branch's own `npm test` explicitly includes `web-test-kit` and `sovereign-automation`
> product suites so the branch CI covers its own code; mainline suites (74 files)
> are untouched and remain the authoritative released-set tracker. The 721-vs-92
> file count reflects branch-only cubes, not a silent omission.

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
