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

- Node.js / JavaScript → npm as an optional ecosystem registry; GitHub is canonical
- Python → PyPI as an optional ecosystem registry for suitable general-purpose Cubes; GitHub is canonical
- Kotlin / JVM → Maven-compatible distribution as an optional ecosystem registry; GitHub is canonical
- Android → first-class Kotlin/Android target
- iOS / Apple platforms → future native Swift-facing and/or KMP-based distribution where justified

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

### Completed: Package Contract / Tooling

`docs/PACKAGE_CONTRACT_V0.1.md` is frozen. The two pilot packages are implemented with isolated manifests, exact `exports`, generated declarations, tarball boundaries, and npm pack verification.

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
- the first authorized candidates remain `TECHNICALLY_READY / AUTHORIZED / NOT YET GITHUB-RELEASED`;
- existing eligible Cubes continue through the standalone-library qualification wave.

### Historical: First Public Batch Publication — SUPERSEDED

The following historical state is preserved for auditability. It described an earlier phase in which publication was treated as the immediate task and the environment prerequisite was specifically npm authentication/ownership. That state is no longer the current project policy.

**Technical readiness and human release authorization are complete.** The current task in that historical phase was to complete publication of the two authorized candidates.

Historical publication status was **blocked by the environment prerequisite** recorded in `docs/release/AUTHORIZATION_PACKAGE_STATUS-V0.1.json`: the authorized environment must provide valid npm authentication and verified `@sovereign` ownership. No agent may invent credentials, commit tokens, modify `publishConfig` to bypass the guard, or silently change the authorized source.

Historical controlled path:

`FINAL CLEAN VERIFY -> TAG/RELEASE -> PUBLISH -> POST-PUBLISH VERIFY -> FREEZE -> UPDATE CONTROL PLANE`

The historical record remains preserved and must not be interpreted as a current requirement to publish to npm.

## Future product direction

## Current reconciliation — post-Python native wave

The first native Python wave is now complete for the SPR1 and RCI1 contract families. The shared language-neutral conformance vectors and runners are implemented and CI-enforced; native Python implementations pass the same contract vectors and their native test suites across the supported CI matrix.

The **Browser/Product wave is the current active technical layer**. It is **not completed yet**. The authoritative qualification matrix currently records the seven Browser integration Cubes as `PRE_RELEASE`, with no package contracts independently satisfied yet. Therefore this roadmap must not claim Browser/Product release or completion prematurely.

The next eligible sequence is:

`BROWSER CORE -> ASSERTIONS -> INTERACTIONS -> NETWORK -> RECORDER -> TAB MANAGER -> VISUAL TESTING -> PRODUCTS`

with per-Cube package contracts, out-of-tree verification, reproducibility, security, cross-platform evidence, and real-browser evidence where applicable.

Kotlin/JVM, Android, and Apple-native waves remain future layers after the Browser/Product wave and after applicability/conformance criteria are satisfied. No fake ports are to be created.

This reconciliation is additive and preserves the historical roadmap above; it only anchors the current execution sequence to repository evidence.
