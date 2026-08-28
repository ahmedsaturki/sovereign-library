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

### Active: Explicit Release Authorization

**Technical readiness is complete.** The next and only active decision is an explicit release-authorization decision for the two candidates.

Until that decision exists, the following remain prohibited:

- npm organization creation or reservation
- npm token configuration
- registry automation
- `npm publish`
- GitHub Packages publication
- public release announcements

Once explicitly authorized, the controlled path becomes:

`AUTHORIZED -> FINAL CLEAN VERIFY -> TAG/RELEASE -> PUBLISH -> POST-PUBLISH VERIFY -> FREEZE`

## Future product direction

After package-readiness is proven, Browser Automation remains the strongest product wedge because it composes a large set of stabilized primitives. This is a future product milestone, not an active implementation task during Phase 0.

No second Cube may start concurrently with the current Phase 0 task.

---

## Reconciliation block (added 2026-08-28)

> The release log above (top of file) is **historical evidence** and is preserved, not
> erased. It was last showing **Glob / Path Matcher v0.1 (PR #87)** as the "latest released
> cube." That log lagged the control plane. The **authoritative current state** lives in
> `PROJECT_CONTROL.md`; this block anchors the two together so neither conflicts nor is lost.

### Authority note

- **`PROJECT_CONTROL.md` is the single source of truth for current state / what changed /
  next task.** The top-of-file release log in this ROADMAP is historical and must not be read
  as "current."
- For the full operating model, governance DO-NOT list, and recovery order, see
  `AGENTS.md` and `GOVERNANCE.md` (added 2026-08-28 to make the repo self-recovering).

### Current state (authoritative, from PROJECT_CONTROL.md at HEAD `04fe95b`)

- Latest **released + FROZEN** cube: Application Lifecycle / Graceful Shutdown Coordinator
  v0.1 — PR #104 — `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`.
- Phase 0 milestone: **`PHASE-0-RELEASE-AUTHORIZATION-READY`**.
- Immediate next task (HUMAN decision): explicit release-authorization for the two verified
  candidates `@sovereign/safe-path-resolver` v0.1.0 and `@sovereign/runtime-capability-inspector`
  v0.1.0 — tracked in **issue #110** (decision: PENDING).
- Distribution policy: **GitHub-only** (no external registry publication). See `GOVERNANCE.md`.

### Governance flags (do not act without explicit re-authorization)

- **PR #111** (`feat/browser-interactions-assertions-webtestkit`) is **PARKED — do not merge.**
  See `GOVERNANCE.md`.
- Safe Path Resolver cube source is merged into `main` (commit `0216f3a`); its **public
  package** remains pending authorization (issue #110). The cube exists in-tree; it is not
  authorized for external distribution.
- An orphaned hardening branch `safe-path-resolver-containment-boundary-v0-1-final-verify`
  (HEAD `b52473ee8f4148932ec3d8526bbfe3ef5abac14c`, 13 commits ahead of `main`) holds further
  SPR1 integrity/symlink/namespace hardening not yet in `main`. Preserved on `origin`; merging
  needs its own explicit review.
