# Sovereign Library — Governance & Standing Decisions

> This file is the authoritative home for governance decisions and the hard DO-NOT list.
> It is referenced by `AGENTS.md` (agent entry) and `PROJECT_CONTROL.md` (control plane).
> It exists so that critical operating constraints survive without depending on human or
> agent memory. Add to it when a new standing decision is made; do not delete history.

## DO-NOT list (hard constraints)

These constraints are binding. They were established to keep the project recoverable,
non-destructive, and within its stated distribution policy.

1. **Never merge PR #111** — `feat/browser-interactions-assertions-webtestkit`.
   - Content: adds `browser-interactions` + `browser-assertions` cubes and a `web-test-kit`
     product.
   - Status: intentionally **PARKED**. Browser/product work is its own wave under the
     Browser/Product policy (Architecture Constitution, rule #19). It must not silently
     convert a pre-release into a release, and it must not enter `main` until explicitly
     reclassified and authorized.
   - Head SHA at last reconciliation: `74bdccc2b80017c186b50100801926c35715e0f5`.
2. **Never publish to external registries** (npm, PyPI, Maven Central, others) under the
   current **GitHub-only** distribution policy. Independent library packaging stays mandatory,
   but distribution is GitHub: source, tags, GitHub Releases, release assets, checksums,
   reproducible artifacts.
3. **Never push directly to `main`** for substantive change without an explicit, reviewed PR.
   (`main` protection is tracked by issue #109; treat `main` as protected by discipline now.)
4. **Never force-push** to any shared branch.
5. **Never rewrite history** — no root rebase, no `filter-branch`, no amending pushed history.
6. **Never modify frozen/released code** (runtime OR tests) without separate explicit
   authorization. Frozen SHAs are immutable evidence.
7. **Never delete** released/frozen cubes, packages, docs, tests, APIs, contracts, or roadmap
   items to "clean up." Prefer archive / deprecate / mark-obsolete / move to historical.
8. **CI success ≠ publication authorization.** Authorization is a separate human decision
   (issue #110).

## Standing distribution policy

- **Current policy: GitHub-only.** No external registry publication is authorized.
- Changing this requires an explicit, recorded decision in this file and `PROJECT_CONTROL.md`.
- The first package batch candidates are staged under `packages/` and verified by CI but are
  **NOT authorized for publication** until issue #110 is decided positively.

## Release authorization gate (current)

- Candidates: `@sovereign/safe-path-resolver` v0.1.0, `@sovereign/runtime-capability-inspector`
  v0.1.0.
- Readiness: **TECHNICALLY_READY / VERIFIED** (Run #845, Run #849 across Ubuntu, Windows,
  macOS-15-Intel). Records: `docs/PUBLIC_PACKAGE_RELEASE_READINESS_V0.1.md`,
  `docs/PUBLIC_PACKAGE_RELEASE_AUTHORIZATION_PACKET_V0.1.md`.
- Decision: **PENDING** (issue #110). No npm credentials, org config, tokens, or registry
  automation may be created until a positive decision is recorded.
- Controlled release path once authorized:
  `AUTHORIZED → FINAL CLEAN VERIFY → TAG/RELEASE → PUBLISH → POST-PUBLISH VERIFY → FREEZE`.

## Known reconciliation notes (historical, not deletions)

- `ROADMAP.md` release log had drifted (was last showing PR #87 / Glob-Path-Matcher as the
  latest released cube). The authoritative current-state head is `PROJECT_CONTROL.md`
  (latest released cube: Application Lifecycle / Graceful Shutdown Coordinator v0.1, PR #104,
  FROZEN at `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`). A reconciliation block was added to
  `ROADMAP.md` linking the control plane; the older release log is preserved, not erased.
- Safe Path Resolver / Containment Boundary v0.1 source was merged into `main`
  (commit `0216f3a`), but its **public package** remains pending authorization (see above).
  This is recorded honestly: the cube exists in-tree; the package is not yet authorized for
  external distribution.
- An orphaned hardening branch `safe-path-resolver-containment-boundary-v0-1-final-verify`
  (HEAD `b52473ee8f4148932ec3d8526bbfe3ef5abac14c`, 13 commits ahead of `main`) holds further
  SPR1 integrity + symlink-depth + namespace-root hardening not yet merged into `main`. It is
  preserved on `origin` and must not be lost; merging it requires its own explicit review.

## How to add a standing decision

Append a dated, SHA-anchored entry here and update `PROJECT_CONTROL.md`. Never remove a prior
decision; if it is superseded, mark it SUPERSEDED with the replacement reference.
