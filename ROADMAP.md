# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Directory Walker / Bounded Tree Traversal v0.1

PR #92 was squash-merged as `4d64f6610286524799ebe809021279a7b7be3d40`.

Pre-merge **Run 674** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke. Post-merge **Run 675** passed on all three platforms with the same gates.

The cube is **FROZEN** at `4d64f6610286524799ebe809021279a7b7be3d40`.

### Safe Path Resolver / Containment Boundary v0.1

PR #90 was squash-merged as `0216f3acd81331c031ac0ae023bfc1322f9064bc`.

Exact-SHA external verification at `b52473ee8f4148932ec3d8526bbfe3ef5abac14c` passed: 400+ repository tests, 14/14 cube-specific tests, and browser smoke 1/1. Pre-merge **Run 664** passed on Ubuntu, Windows, and macOS-15-Intel. Post-merge **Run 665**, attempt 2, passed on all three platforms after a transient macOS runner hang on attempt 1.

The cube is **FROZEN** at `0216f3acd81331c031ac0ae023bfc1322f9064bc`.

### Glob / Path Matcher v0.1

PR #87 was squash-merged as `c9a3d330a16a488e00c28311085204363bab2fc7`.

Pre-merge **Run 654** and post-merge **Run 655** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke. Blocking fixes included escape-tokenization ordering and explicit absolute-root anchoring; regression coverage was added.

The cube is **FROZEN** at `c9a3d330a16a488e00c28311085204363bab2fc7`.

### Host Identity / Environment Fingerprint v0.1

PR #86 was squash-merged as `a7264db2b61c5cdc6ad33b04fc3a97c4fe47d24e`.

Pre-merge **Run 644** passed on Ubuntu, Windows, and macOS-15-Intel. Post-merge **Run 645** passed on Windows and macOS-15-Intel on the original attempt; Ubuntu browser smoke experienced a transient runner hang and then passed on an independent same-commit rerun.

The cube is **FROZEN** at `a7264db2b61c5cdc6ad33b04fc3a97c4fe47d24e`.

### Directory Snapshot / Tree Manifest v0.1

PR #85 was squash-merged as `c01cc08e97404d1528fb93d6728fd2ae272871c3`.

Pre-merge **Run 633** and post-merge **Run 635** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.

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

The cube is **FROZEN** at `33b98771c4702a02dbdc3ce267af516bfbd8e43c`.

### File Lease / Advisory Lock v0.1

PR #80 was squash-merged as `b3d4f1dc61a6ed64d642fc0a9a92466c01da2868`.

Pre-merge Run 607 and post-merge Run 608 passed across Ubuntu, Windows, and macOS-15-Intel.

The cube is **FROZEN** at `b3d4f1dc61a6ed64d642fc0a9a92466c01da2868`.

### Filesystem Watcher / Change Stream v0.1

PR #79 was merged as `239e418e620d06de5d25a9c40905f6efc42334b3`.

Post-merge Run 598 passed across Ubuntu, Windows, and macOS-15-Intel.

The cube is **FROZEN** at `239e418e620d06de5d25a9c40905f6efc42334b3`.

### Runtime Capability Inspector / Preflight v0.1

PR #78 was squash-merged as `139a7d6c824b7fe522712c65e1b9ffcf605e134f4`.

Pre-merge Run 580 and post-merge Run 581 passed across Ubuntu, Windows, and macOS-15-Intel.

The cube is **FROZEN** at `139a7d6c824b7fe522712c65e1b9ffcf605e134f4`.

### Previous release chain

Artifact Release Publication Confirmation / Outcome Receipt v0.1 — PR #77 — `ee642ac4f760da6ee6263faa5e82bf7d197fa78d`

Artifact Release Publication Executor / Boundary v0.1 — PR #76 — `23cf7b06e9162201683eb613d6c71c241cb5e34e`

Artifact Release Closure Receipt / Finalization v0.1 — PR #75 — `0e1adc1fc41924c4df14c5b10aa5ed1278297b90`

Earlier released cubes remain pinned to their recorded immutable SHAs.

## Active milestone

### FILESYSTEM-METADATA-STAT-NORMALIZER-V0.1-SPEC

Directory Walker / Bounded Tree Traversal v0.1 is complete and frozen.

The next selected standalone product is:

**Filesystem Metadata / Stat Normalizer v0.1**

Rationale:

- normalizes platform-specific filesystem metadata into a stable, dependency-free contract
- separates metadata semantics from traversal and snapshot concerns
- gives later cubes a deterministic, immutable representation of `lstat`/`stat` results
- keeps privacy boundaries explicit so host/user/device metadata is never leaked accidentally
- supports failure/recovery around races, permission errors, missing entries, and malformed capability results

### Immediate next task

Write and commit the complete SPEC at `specs/filesystem-metadata-stat-normalizer-v0.1.md` before implementation begins.

The SPEC must lock:

- cross-platform metadata API
- file/directory/symlink/special kind normalization
- stable numeric/stat fields across POSIX and Windows
- timestamp, size, mode, identity and platform-specific field policies
- capability seam validation and getter/circular protections
- default non-following symlink behavior and explicit target-resolution policy
- bounded metadata, integer-safe fields, and path/name limits
- deterministic serialization/canonical representation
- privacy-safe field allowlisting
- missing, permission-denied, malformed and concurrent-change recovery semantics
- non-mutating guarantees
- Ubuntu, Windows, macOS-15-Intel and relevant WSL verification
- zero-runtime-third-party-dependency boundary

No implementation starts before this SPEC exists on the control plane.

## Parked

All other capabilities remain parked until the current cube is released and frozen. New ideas must not bypass the one-current-task rule.
