# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

**Agent entry:** every autonomous agent must read `AGENTS.md` first, then this file. The permanent architecture contract is `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md`, and the project-wide knowledge map is `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md`.

## Current mission

**LIBRARY DISTRIBUTION EXPANSION — ACTIVE (GitHub-first / free multi-channel optional)**

The immediate objective is to qualify existing Sovereign Cubes as real standalone libraries without deleting, replacing, or destabilizing completed work, while preparing free, reproducible distribution channels for later release waves.

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
- Safe-path dependency-boundary qualification: **Run #33172159240**, final qualification job passed; commit `358cfef8ca168baa9e8402ecd972b2b0bc4d7e48` contains the resulting migration and cleanup. The qualification evidence covered all four previously Conditional consumers plus the existing safe-path/runtime-capability package candidates: targeted tests, package staging, declarations, npm pack contents, reproducibility, and security boundary checks all passed.
- Release-readiness and authorization documents remain historical evidence; current distribution policy is recorded below.
- **Android applicability assessment**: Matrix written (`ANDROID_APPLICABILITY_MATRIX.md`); Cube **safe-path-resolver** (SPR1) selected as first candidate. Native Android build, AAR package verification, and reproducibility are verified. Emulator instrumentation qualification is gated by the dedicated Ubuntu ADB instrumentation step; do not mark Android TECHNICALLY_READY until that evidence is terminal-successful.
- **Phase-2 release-engineering hardening wave landed on `feat/continuity-hardening`**: 20 enterprise capabilities wired in — multi-region CI, E2E (BrowserStack/SauceLabs), perf regression detection, dependabot auto-merge bot, release-notes + changegen automation, DB migration tooling (SQLite in-memory default), API versioning contract, backward-compat diff, feature flags (LaunchDarkly-compatible schema), canary / progressive / blue-green deployment plans, deterministic rollback plan, hermetic chaos engineering probes (process-kill, network-failure, disk-full, clock-jump, signal-storm), load testing (k6 + Locust), FOSSA license compliance, SBOM-per-release + cosign image-signing, OWASP ZAP DAST skeleton. Every script uses Node 24 stdlib only; no new dependencies. `npm run test:phase2` exercises 14 unit tests (all green). `npm run verify` includes Phase-2 tests as the final gate. See `docs/PHASE2_HARDENING.md` for full inventory and run evidence.

## Project-wide architecture law

The repository-wide independence and ecosystem model is governed by:

- `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md`
- `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md`
- `docs/SOVEREIGN_ECOSYSTEM_CONTRACT_V0.1.json`
- `GOVERNANCE.md`

The permanent principle is:

**INDEPENDENT CUBES -> EXPLICIT COMPOSITION -> REAL PRODUCTS**

A suitable Cube is intended to be independently usable, testable, packageable, distributable, versioned, secure, deterministic within contract, failure/recovery hardened, cross-platform where applicable, and replaceable without requiring the whole repository.

Sovereign is not Node-only. The ecosystem target is:

`ONE AUTHORITATIVE CONTRACT -> NATIVE IMPLEMENTATION PER ECOSYSTEM -> CONFORMANCE -> INDEPENDENT DISTRIBUTION`

Target ecosystems include Node.js, Python, Kotlin/JVM, Android, and future iOS/Apple platforms where a Cube is applicable and valuable. These are implementation/distribution targets, not a claim that every Cube already has every port.

An internal dependency is allowed only when it is explicit, versioned, resolvable in the distributed artifact, tested, and consistent with the Cube contract. Monorepo-relative runtime coupling must not leak into released packages.

## Current distribution policy

**GITHUB-FIRST / FREE-MULTI-CHANNEL-OPTIONAL.**

GitHub remains the canonical source, persistent project memory, release-evidence home, and default distribution channel.

Distribution is intentionally free-by-default. Additional ecosystem registries are **optional and deferred by release wave**, not permanently prohibited. A registry may be enabled for a release only when it is genuinely free for the intended workload, technically appropriate, secure, reproducible, and explicitly selected for that release wave.

Canonical GitHub mechanisms:

- Git repository/source;
- Git tags;
- GitHub Releases;
- GitHub Release assets;
- checksums/integrity records;
- documentation and examples.

Optional free ecosystem mechanisms may include npm, PyPI, Maven-compatible registries/Maven Central, GitHub Packages, JSR, or other appropriate services, subject to current terms/limits and a deliberate release decision. No paid registry or mandatory third-party service is required.

No external publication should be attempted merely because a package is technically ready. Release timing and channel selection remain explicit controls.

Historical wording that prohibited external registries absolutely is superseded by this policy and remains preserved as history in governance/release records.

## Current packaging wave

Existing suitable Cubes are being qualified as genuine standalone libraries.

Current package catalog: `scripts/package-catalog.json`.

Current qualification matrix: `docs/release/PACKAGE_QUALIFICATION_MATRIX-V0.1.md`.

The current reported Node packaging wave contains **86 package entries representing 84 unique Cube sources + 2 Products**, with the known distinction that `safe-path-resolver` is the package identity for the `safe-path-resolver-containment-boundary` source Cube.

The qualification rules remain stricter than merely creating `package.json`: exact public API, declaration surface, package boundary, out-of-tree use, reproducibility, security, documentation, and applicable CI evidence are required.

The 7 browser/integration Cubes and 2 Products completed the Browser/Product Readiness Wave (2026-08-28): each now has a `packages/<name>/` staging dir with `files` allowlist + generated `dist/index.d.ts`, a `scripts/package-catalog.json` entry with exact `expected` exports, and out-of-tree import verification. The Products use explicit `@sovereign/*` runtime dependency boundaries (no `../../../cubes/...` monorepo coupling in the published artifact). Real-browser smoke tests against Chromium pass locally and in CI.

Status summary (matrix v17): 84 Cubes TECHNICALLY_READY, 0 PRE_RELEASE, 0 CONDITIONAL. The 2 Products are also TECHNICALLY_READY via the same pipeline.

Remaining categories include:

- The four previously Conditional safe-path-resolver consumers now use explicit @sovereign/safe-path-resolver dependency boundaries and qualify as TECHNICALLY_READY;
- future native Python/Kotlin/Android implementations only where justified by the authoritative contract and practical value.

## Continuity and non-destructive evolution

GitHub is the durable project memory.

Meaningful work is complete only after:

`CHANGE -> TEST -> DOCUMENT -> COMMIT -> PUSH -> VERIFY REMOTE`

The default evolution policy is additive:

`ADD -> EXTEND -> HARDEN -> IMPROVE -> SUPERSEDE -> DEPRECATE -> ARCHIVE -> DEFER`

Do not silently delete or replace working functionality, contracts, tests, packages, history, or architecture merely because a newer approach exists.

Historical failures remain historical evidence. Current state must be updated separately rather than rewriting history.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Current milestone:

**LIBRARY DISTRIBUTION EXPANSION — ACTIVE**

Immediate next task:

**Reconcile and qualify the current live HEAD `2423f39e17e4cbaec41818140fdd9cc99fc9fb05` through terminal CI evidence, then fix the first real current-head failure. Do not treat queued/pending/historical results as success or failure.**

The Browser/Product Readiness Wave and the current Python native-port inventory remain completed historical qualification layers; do not redo them without a demonstrated regression.

## Current repository state — live control plane

- Current branch: `feat/continuity-hardening`
- Current HEAD: `2423f39e17e4cbaec41818140fdd9cc99fc9fb05`
- PR #125: **OPEN / UNMERGED**
- Base: `main`
- Publication status: **NOT PERFORMED**
- Current source of truth: live GitHub branch ref, not an embedded historical SHA in older sections of this file.

### Recent hardening commits on the live branch

- `f107c340c84c0fd98a09e9f6b9f397284ffa1559` — Windows Android SDK batch-tool invocation hardening.
- `beabe589dd025327c78049d0b5d411db14090cd5` — security-pipeline Python-manifest discovery correction.
- `a3e1515152eb7fa9e120705c55e1176bb123f751` — release-engineering workflow evaluation hardening and secret-guard correction.
- `2423f39e17e4cbaec41818140fdd9cc99fc9fb05` — manual authorized-release workflow corrected to use valid GitHub artifact attestation instead of a reusable workflow invoked as a step.

### Current CI evidence

- The current HEAD `2423f39e17e4cbaec41818140fdd9cc99fc9fb05` has a fresh **phase3 hardening aggregator** check queued (run `35011284960`). Terminal success is not yet established.
- The preceding live-head `a3e1515152eb7fa9e120705c55e1176bb123f751` successfully instantiated the rewritten **release-engineering** workflow. Its tag-only jobs were correctly skipped on a branch push, while the non-tag jobs were created; terminal completion of those jobs is not yet evidence for the current HEAD.
- Historical CI results for `a55e31...`, `cac209c...`, or older SHAs remain historical and must not be used as current-head proof.

### Android status

**NOT CURRENTLY QUALIFIED ON THE LIVE HEAD.**

The previous Ubuntu emulator timeout remains historical evidence. The Android workflow has since been hardened for current Windows SDK command-line tool behavior, but Android SPR1 must not be promoted to TECHNICALLY_READY until a terminal-successful current-head emulator instrumentation result exists.

### Python ports inventory

- sovereign_safe_path_resolver (SPR1): 7/7 ✓
- sovereign_runtime_capability_inspector (RCI1): 9/9 ✓
- sovereign_canonical_json (CJSON1): 15/15 ✓
- sovereign_result (RES1): 17/17 ✓
- sovereign_digest (DIG1): 16/16 ✓
- sovereign_cache (CACH1): 15/15 ✓
- sovereign_validation (SVAL1): 18/18 ✓
- sovereign_url (SURL1): 8/8 ✓
- sovereign_retry (RTRY1): 20/20 ✓
- sovereign_circuit_breaker (RCBR1): 10/10 ✓

These counts are qualification evidence for the respective native ports; they are not substitutes for current-head CI evidence.

## Historical control-plane records

Earlier feature-branch documentation recorded older heads and older CI runs. Those statements are retained as historical source/CI evidence and must not override the live branch ref above.

The 2026-09-01 reconciliation record reported older exact heads and an Android infrastructure timeout. That record is superseded by the live control-plane section above.

The older `PRE_RELEASE` wording remains only as historical evidence from the earlier reconciliation phase.

## Governance locks

- PR #125 remains **OPEN / UNMERGED**.
- No external package publication has been performed.
- No credential or 2FA guard has been bypassed.
- No Android emulator requirement has been removed.
- No tests may be weakened merely to obtain green CI.
- Historical contradictory wording must not override the live control-plane state above.
