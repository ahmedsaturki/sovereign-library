# Sovereign Library — Governance & Standing Decisions

> Authoritative home for governance decisions and the hard DO-NOT list. Referenced by
> `AGENTS.md` and `PROJECT_CONTROL.md`. Add to it when a new standing decision is made; never
> delete history — if a decision is superseded, mark it SUPERSEDED with the replacement.

## DO-NOT list (hard constraints)

1. **Never merge PR #111** — `feat/browser-interactions-assertions-webtestkit`.
   - Content: `browser-interactions` + `browser-assertions` cubes and a `web-test-kit` product.
   - Status: **PARKED**. Browser/product work is its own wave (Architecture Constitution,
     rule #19). Must not silently convert a pre-release into a release, and must not enter
     `main` until explicitly reclassified and authorized.
   - Head SHA at last reconciliation: `74bdccc2b80017c186b50100801926c35715e0f5`.
2. **Never push directly to `main`** for substantive change without an explicit, reviewed PR.
   (`main` protection tracked by issue #109; treat `main` as protected by discipline.)
3. **Never force-push** to any shared branch.
4. **Never rewrite shared history** (no root rebase, no `filter-branch`, no amending pushed history).
5. **Never modify frozen/released code** (runtime OR tests) without a separate authorized task.
   Frozen SHAs are immutable evidence.
6. **Never delete** released/frozen cubes, packages, docs, tests, APIs, contracts, or roadmap
   items to "clean up." Prefer archive / deprecate / mark-obsolete / move to historical.
7. **CI success ≠ publication authorization.** Authorization is a separate human decision (issue #110).

## Distribution policy (reconciled 2026-08-28)

- **GitHub is canonical.** Free ecosystem registries are *optional*, enabled per release wave.
- Optional channels (only when free, secure, reproducible, useful, explicitly enabled):
  npm, PyPI, Maven Central / Maven-compatible, GitHub Packages, JSR, other native registries.
  No paid registry required. Do NOT publish merely because a package exists.
- **SUPERSEDED [historical]:** an earlier directive stated a stricter absolute "never publish to
  external registries" rule. It was superseded by the GitHub-canonical + optional-free-registries
  policy above. The older reading is historical, not current. The first batch remains
  publication-deferred by project timing (see below), independent of which policy applies.
- The first two candidates are **AUTHORIZED IN PRINCIPLE** but **publication is deferred by
  project timing** while library expansion continues (per the master continuation directive).

## Release authorization gate (current)

- Candidates: `@sovereign/safe-path-resolver` v0.1.0, `@sovereign/runtime-capability-inspector` v0.1.0.
- Readiness: **TECHNICALLY_READY / VERIFIED** (Run #845, Run #849 across Ubuntu, Windows,
  macOS-15-Intel). Records: `docs/PUBLIC_PACKAGE_RELEASE_READINESS_V0.1.md`,
  `docs/PUBLIC_PACKAGE_RELEASE_AUTHORIZATION_PACKET_V0.1.md`.
- Decision: **PENDING** (issue #110). No npm org config, tokens, or registry automation may be
  created until a positive decision is recorded.
- Controlled release path once authorized:
  `FINAL CLEAN VERIFY → PACKAGE → GITHUB RELEASE → OPTIONAL FREE REGISTRIES →
   POST-DISTRIBUTION VERIFY → FREEZE → CONTROL-PLANE UPDATE`.

## Package qualification (current state)

- **Declarative catalog:** `PACKAGE_CATALOG.json` (schema `sovereign-package-catalog/v1`),
  generated from `origin/main`, records 78 cubes: 74 STANDALONE, 4 CONDITIONAL, 77 eligible,
  2 first-batch staged. Every cube's id, packageId, export surface, test/README status, and
  conditional-dependency remediation are enumerated.
- **Generic pipeline (catalog-driven), supplementary to the original first-batch scripts:**
  - `scripts/package-catalog-stage.mjs` — stages any eligible cube from the catalog.
  - `scripts/verify-package-catalog.mjs` — manifest/export-map/contents verification.
  - `scripts/verify-package-catalog-reproducible.mjs` — byte-identical tarball verification.
  - Original `scripts/package-stage.mjs`, `scripts/verify-package-tooling.mjs`,
    `scripts/verify-reproducible-package.mjs` remain the canonical first-batch gate.
- **Verified (real execution, 2026-08-28):** 13 staged packages pass both manifest/export-map
  and reproducible-byte-identical verification. 12 are eligible standalone + the first-batch
  `safe-path-resolver`. Out-of-tree import confirmed for `safe-path-resolver` and
  `canonical-json` (tarball extracted outside the repo, `import()` executed real APIs).

## CONDITIONAL cubes (remediation required before packaging)

Four cubes import the first-batch via a monorepo-relative path and must be remediated:

- `bounded-file-content-reader-safe-content-access`
- `directory-walker-bounded-tree-traversal`
- `filesystem-metadata-stat-normalizer`
- `safe-file-quarantine-delete`

Each currently does: `import { resolveContained } from '../../safe-path-resolver-containment-boundary/src/index.js';`
Remediation: replace with a declared dependency on `@sovereign/safe-path-resolver` (first
authorized batch) resolved via the package manager; never ship monorepo path as distributed
runtime coupling. Recorded under `PACKAGE_CATALOG.json` → cube → `conditionalDependency.remediation`.
This is **not yet applied** — it needs its own authorized task (directive #9/#28).

## Known reconciliation notes (historical, not deletions)

- `ROADMAP.md` release log had drifted (last showed PR #87 / Glob-Path-Matcher). `PROJECT_CONTROL.md`
  is authoritative; a reconciliation block in `ROADMAP.md` links the two. (Added 2026-08-28.)
- An orphaned hardening branch `safe-path-resolver-containment-boundary-v0-1-final-verify`
  (HEAD `b52473ee8f4148932ec3d8526bbfe3ef5abac14c`, 13 commits ahead of `main`) holds further
  SPR1 integrity/symlink/namespace hardening not yet in `main`. Preserved on `origin`; merging
  needs its own explicit review.
- Safe Path Resolver cube source is merged into `main` (commit `0216f3a`); its public package
  remains pending authorization (issue #110). The cube exists in-tree; it is not authorized for
  external distribution.

## How to add a standing decision

Append a dated, SHA-anchored entry here and update `PROJECT_CONTROL.md`. Never remove a prior
decision; if superseded, mark it SUPERSEDED with the replacement reference.
