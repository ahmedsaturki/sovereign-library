# Sovereign Library — Cube Inventory & Classification v0.1

## Purpose

Establish a reproducible classification boundary before public packaging. A directory under `cubes/` is not automatically a public package candidate.

## Classification model

| Class | Meaning | Public package eligibility |
|---|---|---|
| RELEASED-FROZEN | Passed the project release sequence and is pinned by control/roadmap | Candidate after package-readiness gates |
| IMPLEMENTATION-COMPLETE | Implementation/tests/docs exist, but the cube has not passed the current release/freeze gate | Not yet |
| INCUBATING | Partial implementation, incomplete contract, or incomplete hardening | No |
| EXPERIMENTAL | Exploratory/prototype behavior or product-specific work without a stable reusable contract | No |
| PRODUCT-INTERNAL | Valid component for a higher-level product, but not justified as a reusable public primitive | No |

## Current release set

The repository control plane records these recent frozen releases:

1. Application Lifecycle / Graceful Shutdown Coordinator v0.1 — PR #104 — `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`
2. Process Supervisor / Managed Child Lifecycle v0.1 — PR #102 — `881435f121d09099b9b263fa906f0968c42e4539`
3. Filesystem Recovery Journal / Operation Ledger v0.1 — PR #101 — `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`
4. Safe File Quarantine / Delete v0.1 — PR #100 — `699d4181f0775af93b62d78f47fb00de42ec346e`
5. Bounded File Content Reader / Safe Content Access v0.1 — PR #99 — `f8db5a309aef655aec86051587bdf12d34f3dd20`
6. Filesystem Permission / Ownership Descriptor v0.1 — PR #98 — `69028a66b3827ecfee4a70f2460998dd333f02e0`
7. Atomic Batch File Transaction / Safe Multi-File Commit v0.1 — PR #96 — `1fae6399eb2710b53cc8f53878138ae9a24a241d`

Earlier frozen cubes remain authoritative in repository history and control documents.

## Artifact Release series — classification decision

The Artifact series is **split**, not treated as one 16-package public batch.

### Reusable foundation candidates

- `artifact-bundle` — deterministic local bundle format and verification.
- `artifact-catalog` — local deterministic package/artifact index.
- `artifact-reference-resolver` — candidate reusable reference/identity boundary.
- `artifact-dependency-graph` — candidate reusable dependency graph primitive.

### Generic governance candidates requiring deeper API review

- `artifact-admission-gate`
- `artifact-compliance-policy-evaluator`
- `artifact-provenance-lineage-ledger`
- `artifact-reconciliation-consistency-checker`
- `artifact-audit-drift-reporter`
- `artifact-lifecycle-retention`

These may become reusable governance primitives, but they are not automatically part of the first public batch.

### Product/domain-internal candidates

- `artifact-release-plan`
- `artifact-release-snapshot`
- `artifact-release-approval`
- `artifact-release-closure-receipt`
- `artifact-release-publication-executor`
- `artifact-release-publication-confirmation`

These are presently treated as artifact-release product workflow components until a separate reuse review proves otherwise.

## First public-package candidate set

The first public batch is a **candidate set, not a release commitment**. The final set is frozen only after API and security review.

Priority candidates should favor primitives with multiple independent consumers and minimal product coupling:

1. Safe Path Resolver / Containment Boundary
2. Glob / Path Matcher
3. Filesystem Watcher / Change Stream
4. File Lease / Advisory Lock
5. Atomic File Writer / Safe Replace
6. Ephemeral Workspace / Scratch Directory
7. Directory Snapshot / Tree Manifest
8. Runtime Capability Inspector

Process/runtime cubes remain strong candidates for a later second batch because the public contract should first be validated through higher-level composition.

## Non-goals of this phase

- No npm publication.
- No public package name reservation assumed.
- No license file added yet.
- No full TypeScript rewrite.
- No migration of incubating cubes.
- No `cubes/` directory reshuffle merely to make counts look cleaner.

## Decision rule

A cube enters public-package readiness only when all of the following are independently true:

`RELEASED-FROZEN + stable public API + package metadata + exports contract + type/declaration strategy + security review + reproducible pack + cross-platform verification + documentation`.

## Source of truth

This inventory is an explicit Phase 0 decision record. Runtime/release truth remains `PROJECT_CONTROL.md`, `ROADMAP.md`, Git history, and CI evidence.
