# Sovereign Library Roadmap

## Release discipline

One active Cube or readiness task at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A Cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released Cube

### Application Lifecycle / Graceful Shutdown Coordinator v0.1

PR #104 — release merge `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`.

The Cube is **FROZEN**.

## Recent frozen releases

- Process Supervisor / Managed Child Lifecycle v0.1 — PR #102 — `881435f121d09099b9b263fa906f0968c42e4539`
- Filesystem Recovery Journal / Operation Ledger v0.1 — PR #101 — `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`
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

### Completed: Publication Guard Implementation

`scripts/verify-publication-guard.mjs` is wired into `.github/workflows/verify.yml`. It prevents accidental publication/configuration drift by rejecting publish commands, registry credentials, registry overrides, `publishConfig`, package scripts, and runtime dependency declarations for the first zero-runtime-dependency batch.

**Run #837** is the cross-platform verification for this guard. Ubuntu has already passed the complete matrix; Windows and macOS were still completing the matrix when this roadmap entry was written.

### Active: First Small Public Package Batch — Release Preparation

Candidates:

1. `@sovereign/safe-path-resolver` v0.1.0
2. `@sovereign/runtime-capability-inspector` v0.1.0

Release-preparation record: `docs/PUBLIC_PACKAGE_RELEASE_READINESS_V0.1.md`.

Immediate gate: finish the publication-guard verification matrix, freeze the release-readiness evidence, and prepare a release authorization packet. No npm organization, token, registry automation, or publication is authorized yet.

## Future product direction

After package-readiness is proven, Browser Automation remains the strongest product wedge because it composes a large set of stabilized primitives. This is a future product milestone, not an active implementation task during Phase 0.

No second Cube may start concurrently with the current Phase 0 task.
