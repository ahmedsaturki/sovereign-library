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
- **Phase-2 release-engineering hardening wave landed on `feat/continuity-hardening`**: multi-region CI, E2E (BrowserStack/SauceLabs), perf regression detection, release-notes + changegen automation, DB migration tooling, API versioning, backward-compat diff, feature flags, canary/progressive/blue-green deployment plans, deterministic rollback plan, hermetic chaos probes, k6 + Locust load testing, FOSSA license compliance, SBOM/cosign probes, and an OWASP ZAP DAST skeleton. The Phase-2 scripts remain Node 24 stdlib-oriented with no project runtime dependencies added for these gates.

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

Distribution is intentionally free-by-default. Additional ecosystem registries are optional and deferred by release wave, not permanently prohibited. A registry may be enabled for a release only when it is genuinely free for the intended workload, technically appropriate, secure, reproducible, and explicitly selected for that release wave.

Canonical GitHub mechanisms include the Git repository/source, tags, GitHub Releases, release assets, checksums/integrity records, and documentation/examples.

Optional free ecosystem mechanisms may include npm, PyPI, Maven-compatible registries/Maven Central, GitHub Packages, JSR, or other appropriate services, subject to current terms/limits and a deliberate release decision. No paid registry or mandatory third-party service is required.

No external publication should be attempted merely because a package is technically ready. Release timing and channel selection remain explicit controls.

Historical wording that prohibited external registries absolutely is superseded by this policy and remains preserved as history in governance/release records.

## Current packaging wave

Existing suitable Cubes are being qualified as genuine standalone libraries.

Current package catalog: `scripts/package-catalog.json`.

Current qualification matrix: `docs/release/PACKAGE_QUALIFICATION_MATRIX-V0.1.md`.

The current reported Node packaging wave contains **86 package entries representing 84 unique Cube sources + 2 Products**, with the known distinction that `safe-path-resolver` is the package identity for the `safe-path-resolver-containment-boundary` source Cube.

The qualification rules remain stricter than merely creating `package.json`: exact public API, declaration surface, package boundary, out-of-tree use, reproducibility, security, documentation, and applicable CI evidence are required.

The Browser/Product Readiness Wave remains historical qualification evidence. Current branch work must not regress those package boundaries. Products are expected to compose Cubes without introducing undeclared third-party/runtime dependencies in their distributable artifacts.

Status summary (matrix v17): **84 Cubes TECHNICALLY_READY, 0 PRE_RELEASE, 0 CONDITIONAL**. The 2 Products are also recorded as TECHNICALLY_READY through the same qualification pipeline; any regression must be requalified from the current head.

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

**Qualify the current live HEAD through terminal CI evidence, then fix the first real current-head failure without weakening any gate.**

The Browser/Product Readiness Wave and the current Python native-port inventory remain completed historical qualification layers; do not redo them without a demonstrated regression.

## Current repository state — live control plane

- Current branch: `feat/continuity-hardening`
- Current HEAD: `a43f4045643a97db3b0db95f51c215fa51acb48b`
- PR #125: **OPEN / UNMERGED**
- Base: `main`
- Publication status: **NOT PERFORMED**
- Force-push: **NOT USED**
- Current source of truth: live GitHub branch ref, not an embedded historical SHA in older sections of this file.

### Recent hardening commits on the live branch

- `f107c340c84c0fd98a09e9f6b9f397284ffa1559` — Windows Android SDK batch-tool invocation hardening.
- `beabe589dd025327c78049d0b5d411db14090cd5` — security-pipeline Python-manifest discovery correction.
- `a3e1515152eb7fa9e1207055c55e1176bb123f751` — release-engineering workflow evaluation/secret-guard hardening.
- `2423f39e17e4cbaec41818140fdd9cc99fc9fb05` — authorized-release attestation workflow corrected to use valid artifact attestation.
- `57dd07942c2cea99ee6dee1978536af12a787ab6` — Ubuntu Android instrumentation gate restored.
- `4fc87a446d0533739a7a95f8910196a5cf2421e3` — portable Android emulator/ADB watchdogs and AAR diagnostics.
- `1342a5d3b877aac1abce5eef5d7188fa8965fd0d` — web-test-kit product wiring first hardened.
- `6c39b6a6224dde892177ab4d2d9d900e92555c60` — sovereign-automation product wiring first hardened.
- `7bd5e6dd95121a160604e6ad0cf28f387c8b58c3` — replaced the structurally broken release-engineering workflow tree entry.
- `67aecfc25306e2b3ea40423bcd7324db8d57bec9` — restored the hardened release-engineering workflow with valid k6 action pin and hidden-artifact handling.
- `e31a7ea499cedcabb543052f1481cda67827c5d7` — reconciled live control-plane state.
- `a43f4045643a97db3b0db95f51c215fa51acb48b` — corrected `web-test-kit` Node import maps to use the repo’s in-repo package-linking contract.

### Current CI evidence

At the current live head, a fresh CI cycle has not yet produced terminal results for all workflows. The immediately preceding live-head verification run **#1159** (`35014261952`) failed on all three OS jobs in the bounded contract/integration test step. The failure was deterministic and occurred when `products/web-test-kit` loaded `#browser`: Node 24 rejected the relative `imports` target because it escaped the package boundary (`ERR_INVALID_PACKAGE_TARGET`). The repository’s `scripts/link-browser-cubes.mjs` explicitly exists to supply `@sovereign/*` package links for in-repo product resolution; the product import maps have now been corrected to use those package names.

The other workflows for the prior head were still queued/in-progress and are not success evidence. Current-head CI must be re-run and pass before any readiness status is promoted.

### Android status

**NOT CURRENTLY QUALIFIED ON THE LIVE HEAD.**

Native Android build, AAR package verification, and AAR reproducibility remain verified. Android SPR1 must not be promoted to TECHNICALLY_READY until the current-head Ubuntu emulator instrumentation gate is terminal-successful.

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

The older reconciliation records reported older exact heads and an Android infrastructure timeout. Those records are superseded by the live control-plane section above.

The older `PRE_RELEASE` wording remains only as historical evidence from the earlier reconciliation phase.

## Governance locks

- PR #125 remains **OPEN / UNMERGED**.
- No external package publication has been performed.
- No credential or 2FA guard has been bypassed.
- No Android emulator requirement has been removed.
- No tests may be weakened merely to obtain green CI.
- No force-push is authorized.
- Historical contradictory wording must not override the live control-plane state above.
