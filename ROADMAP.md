# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Directory Snapshot / Tree Manifest v0.1

PR #85 was squash-merged as `c01cc08e97404d1528fb93d6728fd2ae272871c3`.

Pre-merge **Run 633** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.

Post-merge **Run 635** passed on `main` across Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.

The release provides deterministic recursive inventory, explicit file/directory/symlink representation, record/reject/follow-contained symlink policy, cycle protection, bounded traversal, optional injected content digesting, mutation/error policies, canonical serialization and snapshot identity, read-only semantics, and zero runtime third-party dependencies.

The cube is **FROZEN** at `c01cc08e97404d1528fb93d6728fd2ae272871c3`.

### Atomic File Writer / Safe Replace v0.1

Initial PR #82 was squash-merged as `f6bb8d515eade8ac3bd158b851732070c5a9d470`.

Post-merge **Run 620** exposed a real Node 24 compatibility defect: `fsync` had been imported from `node:fs/promises`.

Corrective PR #84 was squash-merged as `4479ae230ccc0ec4ecc1875fcbd16919a80e71bf`.

Corrective pre-merge **Run 622** and post-merge **Run 623** passed on Ubuntu, Windows, and macOS-15-Intel.

The cube is **FROZEN** at `4479ae230ccc0ec4ecc1875fcbd16919a80e71bf`.

### Ephemeral Workspace / Scratch Directory v0.1

PR #81 was squash-merged as `33b98771c4702a02dbdc3ce267af516bfbd8e43c`.

Pre-merge **Run 613** passed on Ubuntu, Windows, and macOS-15-Intel. Post-merge Run 614 initially experienced a transient macOS runner cancellation; an independent rerun on the identical commit passed all gates.

### File Lease / Advisory Lock v0.1

PR #80 was squash-merged as `b3d4f1dc61a6ed64d642fc0a9a92466c01da2868`.

Pre-merge Run 607 and post-merge Run 608 passed across Ubuntu, Windows, and macOS-15-Intel.

### Filesystem Watcher / Change Stream v0.1

PR #79 was merged as `239e418e620d06de5d25a9c40905f6efc42334b3`.

Post-merge Run 598 passed across Ubuntu, Windows, and macOS-15-Intel.

### Runtime Capability Inspector / Preflight v0.1

PR #78 was squash-merged as `139a7d6c824b7fe522712c65e1b9ffcf605e134f4`.

Pre-merge Run 580 and post-merge Run 581 passed across Ubuntu, Windows, and macOS-15-Intel.

### Previous release chain

Artifact Release Publication Confirmation / Outcome Receipt v0.1 — PR #77 — `ee642ac4f760da6ee6263faa5e82bf7d197fa78d`

Artifact Release Publication Executor / Boundary v0.1 — PR #76 — `23cf7b06e9162201683eb613d6c71c241cb5e34e`

Artifact Release Closure Receipt / Finalization v0.1 — PR #75 — `0e1adc1fc41924c4df14c5b10aa5ed1278297b90`

Earlier released cubes remain pinned to their recorded immutable SHAs.

## Active milestone

### HOST-IDENTITY-FINGERPRINT-V0.1-SPEC

The Directory Snapshot / Tree Manifest release is complete and frozen.

The next selected standalone product is:

**Host Identity / Environment Fingerprint v0.1**

Rationale:

- local environment identity is a distinct capability not owned by Runtime Capability Inspector, Configuration, Process, or Directory Snapshot
- it is useful for cache keys, reproducibility records, diagnostics, compatibility reports, test matrices, and local agent/environment attribution
- the safe boundary is read-only and privacy-first: stable non-secret attributes only, with explicit volatile fields kept separate
- native platform APIs and environment primitives are sufficient for the core without third-party runtime dependencies

### Immediate next task

Write and commit the complete SPEC at `specs/host-identity-environment-fingerprint-v0.1.md` before implementation begins.

The SPEC must lock:

- stable vs volatile identity fields
- privacy-safe defaults
- deterministic normalization and serialization
- comparison semantics
- platform/missing-capability behavior
- bounded output size
- capability seams and failure model
- Ubuntu, Windows, macOS-15-Intel, and relevant WSL verification
- zero-runtime-third-party-dependency boundary

No unrelated cube implementation starts before the SPEC gate is complete.

## Parked

All other capabilities remain parked until the current cube is released and frozen. New ideas must not bypass the one-current-task rule.
