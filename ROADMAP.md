# Sovereign Library Roadmap

## Release discipline

One active Cube or readiness task at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A Cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released Cube

### Application Lifecycle / Graceful Shutdown Coordinator v0.1

PR #104 — release merge `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`

Final pre-merge **Run 768** passed on Ubuntu, Windows, and macOS-15-Intel. Post-merge **Run 772** also passed on all three platforms.

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

PR #105 — merge `b0249a3e4d47665b9da0d76eb6cd1009abef6a8f`

Run #773 passed on Ubuntu, Windows, and macOS-15-Intel. The classification record is frozen at `docs/CUBE_INVENTORY_CLASSIFICATION_V0.1.md`.

Artifact Release is split into reusable foundation candidates, generic governance candidates, and product/internal release workflow components; it is not treated as a single public package batch.

### Completed: License Decision

PR #106 — merge `37bdac72bd86c3a190035f3a36a2cfe497fe2812`

Apache License 2.0 is authoritative on `main`, with `LICENSE`, `NOTICE`, and `docs/LEGAL_AND_DISTRIBUTION_POLICY_V0.1.md`. Registry publication remains separately gated.

### Completed: Public API Boundary Freeze

Run #782 passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs green.

The frozen first batch candidates are:

1. Safe Path Resolver / Containment Boundary
2. Glob / Path Matcher
3. Filesystem Watcher / Change Stream
4. File Lease / Advisory Lock
5. Atomic File Writer / Safe Replace
6. Ephemeral Workspace / Scratch Directory
7. Directory Snapshot / Tree Manifest
8. Runtime Capability Inspector

Only symbols explicitly listed in `docs/PUBLIC_API_BOUNDARY_V0.1.md` are public candidates; all other implementation symbols remain internal by default.

### Active: Type / Declaration Strategy

The governing artifact is `docs/DECLARATION_STRATEGY_V0.1.md`.

The repository remains JavaScript-first. The declaration pilot uses JSDoc-driven declaration emission and a repository-level `jsconfig.declarations.json`. The first pilot candidates are Safe Path Resolver and Runtime Capability Inspector.

The pilot is executed as a dedicated job inside `.github/workflows/verify.yml`, sharing the repository's verified CI entry point. No separate declaration workflow is maintained.

The pilot must prove declaration emission and public-surface alignment before package tooling begins.

### Phase 0 order after declaration strategy

1. Inventory & Classification — **DONE / FROZEN**
2. License decision and repository licensing artifacts — **DONE / FROZEN**
3. Public API boundary freeze — **DONE / VERIFIED**
4. Type/declaration strategy without a full rewrite — **ACTIVE**
5. Package contract/tooling (`package.json`, exports, changesets, API extraction)
6. Reproducible `npm pack` and security verification
7. First small public package batch

No public publish is authorized merely because a Cube is technically complete.

## Future product direction

After package-readiness is proven, Browser Automation remains the strongest product wedge because it composes a large set of stabilized primitives. This is a future product milestone, not an active implementation task during Phase 0.

No second Cube may start concurrently with the current Phase 0 task.
