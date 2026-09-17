# Sovereign Library Roadmap

## Release discipline

One active Cube or readiness task at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A Cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Permanent architecture direction

The project-wide architecture is governed by:

- `AGENTS.md`
- `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md`
- `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md`
- `docs/SOVEREIGN_ECOSYSTEM_CONTRACT_V1.0.json`

Permanent model:

`INDEPENDENT CUBES -> EXPLICIT COMPOSITION -> REAL PRODUCTS`

Every suitable Cube should be independently usable, testable, packageable, distributable, versioned, secure, deterministic within its contract, failure/recovery hardened, cross-platform where applicable, and replaceable without requiring the whole system.

The multi-ecosystem model is:

`ONE AUTHORITATIVE CONTRACT -> NATIVE IMPLEMENTATION PER ECOSYSTEM -> CONFORMANCE -> INDEPENDENT DISTRIBUTION`

Target ecosystems:

- Node.js / JavaScript -> npm as an optional ecosystem registry; GitHub is canonical
- Python -> PyPI as an optional ecosystem registry for suitable general-purpose Cubes; GitHub is canonical
- Kotlin / JVM -> Maven-compatible distribution as an optional ecosystem registry; GitHub is canonical
- Android -> first-class Kotlin/Android target
- iOS / Apple platforms -> future native Swift-facing and/or KMP-based distribution where justified

Not every Cube must support every ecosystem. Support is determined by applicability and value.

## Latest released Cube

### Application Lifecycle / Graceful Shutdown Coordinator v0.1

PR #104 — release merge `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`.

The Cube is **FROZEN**.

## Recent frozen releases

- Process Supervisor / Managed Child Lifecycle v0.1 — PR #102 — `881435f121d09099b9b263fa906f0968c42e4539`
- Filesystem Recovery Journal / Operation Ledger v0.1 — PR #101 — `7c197ce5e2d78b0df16265b6c6897812c56ca2`
- Safe File Quarantine / Delete v0.1 — PR #100 — `699d4181f0775af93b62d78f47fb00de42ec346e`
- Bounded File Content Reader / Safe Content Access v0.1 — PR #99 — `f8db5a309aef655aec86051587bdf12d34f3dd20`
- Filesystem Permission / Ownership Descriptor v0.1 — PR #98 — `69028a66b3827ecfee4a70f2460998dd333f02e0`
- Atomic Batch File Transaction / Safe Multi-File Commit v0.1 — PR #96 — `1fae6399eb2710b53cc8f53878138ae9a24a241d`

## Phase 0 — Stabilization & Package Readiness

### Completed: Inventory & Classification

PR #105 — merge `b0249a3e4d47665b9da0d76eb6cd1009abef6a8f`.

### Completed: License Decision

PR #106 — merge `37bdac72bd86c3a190035f3a36a2cfe497fe2812`.

Apache License 2.0 is authoritative on `main`. Registry publication remains separately gated.

### Completed: Public API Boundary Freeze

Run #782 passed on Ubuntu, Windows, and macOS-15-Intel.

The frozen first-batch candidates are documented in `docs/PUBLIC_API_BOUNDARY_V0.1.md`.

### Completed: Type / Declaration Strategy

Run #809 passed on Ubuntu, Windows, and macOS-15-Intel with exact generated public-surface checks for Safe Path Resolver and Runtime Capability Inspector.

### Completed: Android Applicability Assessment

The Android applicability matrix (`ANDROID_APPLICABILITY_MATRIX.md`) was written, `safe-path-resolver` (SPR1) was selected as the first native Android Cube, and the current implementation-head Android qualification is complete. Native Android build, AAR package verification, reproducibility, Windows/macOS instrumentation, and the mandatory Ubuntu Android instrumentation gate all passed in `android` #207 for implementation HEAD `10494f0190b88211926a836c09a305743ccba5ca`.

The former SDK/emulator `IN_PROGRESS` wording is historical and must not be interpreted as current state.

### Completed: Package Contract / Tooling

`docs/PACKAGE_CONTRACT_V0.1.md` is frozen. The pilot packages are implemented with isolated manifests, exact `exports`, generated declarations, tarball boundaries, and npm pack verification.

### Completed: Reproducible Packaging / Security

**Run #835** passed on Ubuntu, Windows, and macOS-15-Intel with byte-identical package reproduction for both pilot candidates, integrity/shasum/file-manifest agreement, security-boundary verification, and browser smoke.

### Completed: Publication Guard

`scripts/verify-publication-guard.mjs` is wired into `.github/workflows/verify.yml`.

**Run #845** at commit `f14bbd9229fcda23f00602cfc9288881c61e213e` passed the complete verification matrix on Ubuntu, Windows, and macOS-15-Intel, including publication guard and real browser smoke.

### Completed: Release Readiness + Authorization Packet Preparation

The following records are frozen:

- `docs/PUBLIC_PACKAGE_RELEASE_READINESS_V0.1.md`
- `docs/PUBLIC_PACKAGE_RELEASE_AUTHORIZATION_PACKET_V0.1.md`

Candidates:

1. `@sovereign/safe-path-resolver` v0.1.0
2. `@sovereign/runtime-capability-inspector` v0.1.0

### Completed: Browser / Product Package Readiness Wave (2026-08-28)

The 7 browser/integration Cubes (`browser`, `browser-assertions`, `browser-interactions`, `browser-network-interception`, `browser-recorder`, `browser-tab-manager`, `browser-visual-testing`) and 2 Products (`web-test-kit`, `sovereign-automation`) completed the qualification pipeline:

- each gained a `packages/<name>/` staging dir with `files` allowlist + generated `dist/index.d.ts` declaration surface;
- each gained a `scripts/package-catalog.json` entry with exact `expected` exports;
- Products use explicit `@sovereign/*` runtime dependency boundaries (no `../../../cubes/...` monorepo coupling in the published artifact), with repo-root `node_modules/@sovereign/<cube>` symlinks (gitignored) for in-repo dev/test resolution;
- out-of-tree import + declaration-surface + `files`-allowlist verification passes for all 9 (`scripts/verify-browser-packages-outoftree.mjs`);
- real-browser smoke (Chromium launch/navigate/evaluate/screenshot/cleanup + Fetch-domain block/passthrough/traffic-log interception) verified against local Chromium and gated in CI;
- `package-stage.mjs` hardened so consumer-cube dependency declarations resolve for `.js` sources (staged dep entry placed at package root with `main`/`types`, not `src/`).

Result: 84 Cubes TECHNICALLY_READY, 0 PRE_RELEASE, 0 CONDITIONAL (matrix v17); 2 Products TECHNICALLY_READY via same pipeline.

### Current: Library Distribution Expansion

**Technical readiness and the initial human authorization decision are complete; publication is intentionally deferred while the library-packaging and ecosystem work continues.**

Current distribution policy is:

`GITHUB CANONICAL + FREE ECOSYSTEM REGISTRIES OPTIONAL`

GitHub is the canonical source, project memory, release-evidence home, and default distribution channel. npm, PyPI, Maven-compatible registries, GitHub Packages, JSR, and other appropriate ecosystem-native mechanisms may be used later when they are genuinely free for the intended workload, technically appropriate, secure, reproducible, and explicitly selected for the relevant release wave.

Current status:

- no npm publication;
- no PyPI publication;
- no Maven Central publication;
- no external registry is required for project distribution;
- GitHub Release artifacts are the default release path;
- GitHub Release objects for the first two authorized candidates already exist in repository release history; external package-registry publication remains deferred/unverified, and release authorization remains a separate control;
- existing eligible Cubes continue through the standalone-library qualification wave.

### Historical: First Public Batch Publication — SUPERSEDED

The following historical state is preserved for auditability. It described an earlier phase in which publication was treated as the immediate task and the environment prerequisite was specifically npm authentication/ownership. That state is no longer the current project policy.

Historical controlled path:

`FINAL CLEAN VERIFY -> TAG/RELEASE -> PUBLISH -> POST-PUBLISH VERIFY -> FREEZE -> UPDATE CONTROL PLANE`

The historical record remains preserved and must not be interpreted as a current requirement to publish to npm.

## Current reconciliation — post-Python / Browser / Android native waves

The first native Python wave is complete for the SPR1 and RCI1 contract families, with current inventory evidence extended through validation, URL, retry, and circuit-breaker ports. The shared language-neutral conformance vectors and runners are implemented and CI-enforced.

The Browser/Product Readiness Wave is complete qualification evidence, not an active unfinished phase. The authoritative qualification matrix records **84 Cubes TECHNICALLY_READY, 0 PRE_RELEASE, 0 CONDITIONAL** with 2 Products TECHNICALLY_READY separately.

The Android applicability/qualification wave is also complete for the first selected Android Cube on the exact implementation head cited above. The mandatory Ubuntu Android instrumentation gate passed, along with Windows and macOS instrumentation on that implementation head.

The current active layer is **Library Distribution Expansion / reconciliation and next-Cube selection**. No registry publication is currently being executed.

## Current exact-head CI evidence — `461bf5a9d902ee24482ab9f84d16abcf70e3898f`

- `verify` #1225 — SUCCESS (macOS timing-only attempt rerun successfully)
- `python-ports` #175 — SUCCESS
- `kotlin-jvm` #165 — SUCCESS
- `phase3` #99 — SUCCESS
- `release-engineering` #92 — SUCCESS
- `android` #224 — SUCCESS

## Current live execution state

- Live branch: `feat/continuity-hardening`.
- Live HEAD: `461bf5a9d902ee24482ab9f84d16abcf70e3898f`.
- PR #125: OPEN / UNMERGED.
- The live branch ref is authoritative for current state; historical SHAs inside older roadmap sections are not current state.
- Fresh exact-head CI for `461bf5a9` completed successfully across `verify` #1225, `python-ports` #175, `kotlin-jvm` #165, `phase3` #99, `release-engineering` #92, and `android` #224.
- Android #224 passed native AAR build, out-of-tree AAR verification, reproducibility, Windows/macOS instrumentation, and the mandatory Ubuntu Android instrumentation gate.
- Verify #1225 passed syntax, bounded contract/integration checks, declaration pilot, package tooling, reproducible packaging, security boundary verification, publication guard, conformance, and real browser smoke across Ubuntu, Windows, and macOS-15-Intel; one macOS attempt failed only on a 1ms timing assertion and the failed job was rerun successfully.
- These runs are the current exact-head qualification evidence for `c581ffe`; any subsequent commit requires its own fresh verification.

## One-current-task rule

Exactly one active milestone and one immediate next task are allowed.

### Active milestone

**LIBRARY DISTRIBUTION EXPANSION — RECONCILIATION / NEXT-CUBE SELECTION**

### Immediate next task

**Select exactly one explicitly authorized next Cube/task from the authoritative project records and execute it through `SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE PREP -> FREEZE`, without redoing completed qualification waves.**

The historical `130 references` statement has been investigated and is **RESOLVED AS REPOSITORY-UNVERIFIABLE HISTORICAL CONTEXT**. No repository-verifiable artifact or reproducible calculation substantiates that number. It MUST NOT be used as a Cube/package/readiness/export count, release-selection basis, or authorization input.

## Governance locks

- No automatic merge of PR #125.
- No external publication without explicit release authorization for that release wave.
- No credential, 2FA, or publication guard bypass.
- No emulator requirement removal.
- No test weakening to obtain green CI.
- No force-push.
- No historical-state rewrite merely to make current state look cleaner.
- Queued, cancelled, partial, or stale CI does not qualify a current HEAD.

## Historical reconciliation note

Earlier roadmap sections intentionally remain as historical audit records where they document phases that were genuinely true at the time. When a current section conflicts with a historical section, the current section and live branch evidence take precedence for execution; historical sections remain read-only evidence of prior state.
