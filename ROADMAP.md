# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Bounded File Content Reader / Safe Content Access v0.1

PR #94 was merged as `277cb8f4d1e8278fe31c8dc7d3269c5c9bbeee99`.

Pre-merge **Run 693** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, **661/661 tests**, and real-browser smoke.

Post-merge **Run 694** passed on the release commit. Mainline Push verification **Run 695** experienced a transient macOS-15-Intel Node.js test-runner hang: the original job and two reruns timed out after the test suite itself reported passing, while the third fresh-run attempt (**macOS Job 98006586509**) passed in 34s with syntax, contract/integration tests, browser smoke, and complete job all green. Ubuntu Job `98006587887` and Windows Job `98006587516` also passed. No product-code or workflow changes were required.

The cube is **FROZEN** at `277cb8f4d1e8278fe31c8dc7d3269c5c9bbeee99`.

### Filesystem Metadata / Stat Normalizer v0.1

PR #93 — `44f1acc2f277a2016013146423bd97a7a4e15057`

### Directory Walker / Bounded Tree Traversal v0.1

PR #92 — `4d64f6610286524799ebe809021279a7b7be3d40`

### Safe Path Resolver / Containment Boundary v0.1

PR #90 — `0216f3acd81331c031ac0ae023bfc1322f9064bc`

### Prior release chain

Glob / Path Matcher v0.1 — PR #87 — `c9a3d330a16a488e00c28311085204363bab2fc7`

Host Identity / Environment Fingerprint v0.1 — PR #86 — `a7264db2b61c5cdc6ad33b04fc3a97c4fe47d24e`

Directory Snapshot / Tree Manifest v0.1 — PR #85 — `c01cc08e97404d1528fb93d6728fd2ae272871c3`

Atomic File Writer / Safe Replace v0.1 — corrective PR #84 — `4479ae230ccc0ec4ecc1875fcbd16919a80e71bf`

Ephemeral Workspace / Scratch Directory v0.1 — PR #81 — `33b98771c4702a02dbdc3ce267af516bfbd8e43c`

File Lease / Advisory Lock v0.1 — PR #80 — `b3d4f1dc61a6ed64d642fc0a9a92466c01da2868`

Filesystem Watcher / Change Stream v0.1 — PR #79 — `239e418e620d06de5d25a9c40905f6efc42334b3`

Runtime Capability Inspector / Preflight v0.1 — PR #78 — `139a7d6c824b7fe522712c65e1b9ffcf605e134f4`

Earlier Artifact Release cubes remain pinned to their recorded immutable SHAs.

## Active milestone

### FILESYSTEM-LEASE-AND-LOCK-REVIEW

Bounded File Content Reader / Safe Content Access v0.1 is complete and frozen.

The immediate next task is a **review of the already-released File Lease / Advisory Lock v0.1** using the current Sovereign release bar and lessons learned from Safe Path, Metadata, Directory Walker, and Reader.

The review must verify:

- public API and standalone usability
- cross-platform locking semantics on Ubuntu, Windows, macOS-15-Intel, and relevant WSL
- stale-owner and abnormal-termination recovery
- timeout, cancellation, acquisition race, release, and cleanup semantics
- deterministic failure codes and privacy-safe diagnostics
- capability-seam boundaries and accessor safety
- documentation, examples, tests, and zero-runtime-dependency compliance

If a concrete gap is found, create a scoped corrective task/PR. If the release is already compliant, close the review and select the next unreleased standalone cube, then write its SPEC before implementation.

No unrelated cube implementation starts before this review gate is complete.

## Parked

All other capabilities remain parked until the current review and subsequent cube release are complete. New ideas must not bypass the one-current-task rule.
