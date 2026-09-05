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

- Node.js / JavaScript → npm
- Python → PyPI for suitable general-purpose Cubes
- Kotlin / JVM → Maven-compatible distribution
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

### Active: First Public Batch Publication

**Technical readiness and human release authorization are complete.** The current task is to complete publication of the two authorized candidates.

Current publication status is **blocked by the environment prerequisite** recorded in `docs/release/AUTHORIZATION_PACKAGE_STATUS-V0.1.json`: the authorized environment must provide valid npm authentication and verified `@sovereign` ownership. No agent may invent credentials, commit tokens, modify `publishConfig` to bypass the guard, or silently change the authorized source.

Once the authorized npm environment is available, the controlled path is:

`FINAL CLEAN VERIFY -> TAG/RELEASE -> PUBLISH -> POST-PUBLISH VERIFY -> FREEZE -> UPDATE CONTROL PLANE`

## Future product direction

After the First Public Batch closes, the next architectural expansion is **Sovereign Multi-Language & Mobile Distribution**:

1. preserve one authoritative SPEC per Cube;
2. add native Python implementations for suitable portable Cubes;
3. add native Kotlin implementations for suitable portable Cubes;
4. make Android a first-class consumer/distribution target;
5. add iOS/Apple support where real value exists, using native Swift-facing APIs and/or Kotlin Multiplatform where justified;
6. introduce language-neutral conformance vectors;
7. distribute each suitable implementation independently through its ecosystem's normal package mechanism.

The next product wave remains Browser Automation and its Products, including Web Test Kit and Sovereign Automation. Browser work is a product composition strategy, not permission to collapse Cube boundaries.

No second Cube may start concurrently with the current official release task.
