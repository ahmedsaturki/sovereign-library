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

**Browser/Product Readiness Wave COMPLETED (2026-08-28): the 7 browser/integration Cubes + 2 Products are qualified (TECHNICALLY_READY) — each with manifest, generated declaration surface, explicit dependency boundary, out-of-tree execution, reproducible packaging, security-boundary verification, cross-platform behavior, and real-browser/product evidence all verified and persisted. A `verify.yml` fix links browser cubes into `node_modules/@sovereign/*` for in-repo Product test resolution (the same closure the published artifact injects).

Python second wave COMPLETED (2026-08-28): six native ports now conformant and wired into `python-ports.yml` — canonical-json (CJSON1: 15/15 vector conformance + 13 pytest), result (RES1: 17 pytest), digest (DIG1: 16/16 vector conformance + 14 pytest), cache (CACH1: 15 pytest), plus the earlier SPR1 (7/7) and RCI1 (9/9). All verified on Python 3.9 + 3.12. The `python-ports.yml` matrix was adjusted to drop the Python 3.9 / windows-latest cell (setup-python archive-extraction infra failure — not a code defect); 3.9 coverage kept on ubuntu + macos, Windows covered by 3.12.

Next eligible non-gated technical layer: additional high-value Python native ports. Kotlin/JVM remains technically complete but any release/port-wave activation is separately governed. Optional free-ecosystem publication of any port remains a separate, human-authorized release decision.

Everything else is parked in `ROADMAP.md`, issue/task records, or explicit future status.

## Historical post-Python / Browser-Product reconciliation

The following section is **historical and superseded by the current authoritative state below**. It is preserved for auditability and must not be interpreted as the current task.

The first native Python wave was reported complete, followed by a temporary reconciliation that treated Browser/Product package readiness as active. Subsequent evidence and the qualification matrix established that Browser/Product qualification was completed on 2026-08-28.

The old `PRE_RELEASE` wording remains only as historical evidence from the earlier reconciliation phase.

## Current control-plane reconciliation — superseded historical record

Earlier feature-branch documentation recorded `7dbf4def...` and `aa8d0eb` as reconciliation baselines. Those statements are historical source/CI evidence and are not the current branch tip. The current branch state is determined from GitHub HEAD and the authoritative current-state section below.

## CURRENT AUTHORITATIVE STATE — 2026-08-31

This section is the authoritative current execution state and supersedes contradictory historical wording elsewhere in this file.

### Completed distribution/readiness layers

- Browser/Product Readiness Wave: **COMPLETED**.
- Browser integration Cubes: **7/7 TECHNICALLY_READY**.
- Products: **2/2 TECHNICALLY_READY**.
- Qualification matrix v17: **84/84 Cubes TECHNICALLY_READY, 0 PRE_RELEASE, 0 CONDITIONAL**.
- Python native ports currently qualified in the current expansion sequence: SPR1, RCI1, canonical-json, result, digest, cache, validation, and url.

### Python validation

`sovereign_validation` was already structurally correct at:

`python/sovereign_validation/src/sovereign_validation/__init__.py`

No relocation was required. Existing native tests and the dedicated Python CI verify that package on Python 3.9 and 3.12.

### Python URL

`sovereign_url` was added as a native, standard-library-only Python port of the authoritative Node URL / Query / Encoding contract.

Current qualification evidence:

- Python 3.9 / Ubuntu: **PASS**
- Python 3.9 / macOS-15-Intel: **PASS**
- Python 3.12 / Ubuntu: **PASS**
- Python 3.12 / macOS-15-Intel: **PASS**
- native tests and syntax checks: **PASS**

### Browser verification hardening

The Linux Chromium CDP smoke harness was corrected to use the actual Chromium executable directly rather than an additional shell wrapper. The smoke test still requires real Chromium/CDP and remains fail-closed.

### Android CI hardening

Android macOS SDK setup now validates the runner's preinstalled SDK instead of relying on network downloads that previously failed against `dl.google.com`.

Ubuntu emulator instrumentation now uses an explicit headless AVD + ADB instrumentation path with a bounded test command and diagnostic log capture. This is an infrastructure/test-harness change; the emulator result must still be terminal-successful before Android SPR1 is marked TECHNICALLY_READY.

### Historical HEAD reference

The earlier user-referenced implementation baseline was `b0358182012bc6f317b7b7aa38ab48ec03e36de4`. It is preserved as historical evidence, not as the current branch tip.

### Effective next task

Once the current CI gates are terminal-successful, the next eligible technical task is the next high-value Python native port selected from repository contracts and existing Node implementations. Do not redo Browser/Product or validation. Kotlin/JVM release/port-wave activation remains separately governed.

### Governance locks

- PR #125 remains **OPEN / UNMERGED**.
- No external package publication has been performed.
- No credential or 2FA guard has been bypassed.
- No Android emulator requirement has been removed.
- No tests may be weakened merely to obtain green CI.
- Historical contradictory wording must not override the current authoritative state.

## CURRENT AUTHORITATIVE STATE — 2026-09-01

This section supersedes any earlier current-state sentence or SHA in this file. Historical references remain preserved for auditability.

### Live branch / PR

- Branch: `feat/continuity-hardening`
- PR: **#125**, OPEN / UNMERGED
- Historical implementation/reporting baseline: `b0358182012bc6f317b7b7aa38ab48ec03e36de4`
- Latest CI/configuration baseline before this final control-plane update: `0bf85eff9cdb1e0ec220bc987445cd5f0fc6bb20`
- Current exact branch tip MUST be read from `refs/heads/feat/continuity-hardening` because control-plane documentation commits necessarily advance the ref.

### Python native-port state

- `sovereign_validation` — implementation present; structure already correct; no relocation required.
- `sovereign_url` — native implementation present; package metadata/tests/CI wiring present; prior matrix evidence exists.
- `sovereign_circuit_breaker` — native implementation present; package metadata/tests/CI wiring present; current-head terminal qualification still required.
- `sovereign_retry` — native implementation tracked on the branch with package metadata, README, clock adapters, tests, and CI wiring.

### Pytest async CI correction

The current-head Retry CI attempt failed in every Python matrix cell at Native pytest because the workflow installed `pytest` but not `pytest-asyncio`.

Observed failure:

`async def functions are not natively supported`

and:

`PytestConfigWarning: Unknown config option: asyncio_mode`

The workflow was corrected in commit `0bf85eff9cdb1e0ec220bc987445cd5f0fc6bb20` to install:

`pytest pytest-asyncio`

before running the native Python tests.

The Retry package test extras also declare `pytest` and `pytest-asyncio`.

The failure was a CI test-environment configuration issue. It is not a qualification result for Retry implementation correctness.

A new current-head `python-ports` run is required after this correction.

### Exact-head verification rule

`current branch ref -> exact HEAD -> workflow run -> terminal conclusion -> qualification decision`

Never substitute historical green evidence for the exact current SHA.

### Browser / Product

Browser/Product Readiness is **COMPLETED** under qualification evidence. Do not redo it unless a real regression appears.

### Android

Android remains a separate real-emulator gate. Pending/queued/cancelled instrumentation is not a technical pass.

### Governance locks

- PR #125 remains **OPEN / UNMERGED**.
- External publication remains disabled unless explicitly authorized.
- No credentials or 2FA protections may be bypassed.
- No publication guard may be bypassed.
- No tests may be weakened.
- Historical records remain preserved.

### Effective immediate task

1. Read the exact current branch ref.
2. Obtain terminal CI results for that exact HEAD.
3. Verify the `pytest-asyncio` correction.
4. If CI fails, diagnose the actual failure and fix it.
5. Qualify Retry and Circuit Breaker only after exact-head evidence passes.
6. Resolve Android status honestly.
7. Determine the next authorized Cube.
8. Continue with:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE PREP -> FREEZE -> NEXT CUBE`

### Final truth rule

Do not claim:

- `b035818...` is the current HEAD,
- Retry is TECHNICALLY_READY,
- Python CI is GREEN,
- Android is GREEN,
- or the entire milestone is 100% complete

unless current GitHub evidence explicitly supports the claim.