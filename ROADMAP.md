# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Filesystem Metadata / Stat Normalizer v0.1

PR #93 was squash-merged as `44f1acc2f277a2016013146423bd97a7a4e15057`.

Pre-merge **Run 681** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, 641 repository tests, and real-browser smoke. Post-merge **Run 682** passed on all three platforms with the same gates.

Run 680 exposed a real Linux timestamp-shape issue: native `birthtimeMs` and related fields may carry valid fractional milliseconds. The implementation now truncates finite non-negative timestamps within the safe range and rejects only unsafe/invalid values.

The cube is **FROZEN** at `44f1acc2f277a2016013146423bd97a7a4e15057`.

### Directory Walker / Bounded Tree Traversal v0.1

PR #92 was squash-merged as `4d64f6610286524799ebe809021279a7b7be3d40`.

Pre-merge **Run 674** and post-merge **Run 675** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.

The cube is **FROZEN** at `4d64f6610286524799ebe809021279a7b7be3d40`.

### Safe Path Resolver / Containment Boundary v0.1

PR #90 was squash-merged as `0216f3acd81331c031ac0ae023bfc1322f9064bc`.

Exact-SHA external verification at `b52473ee8f4148932ec3d8526bbfe3ef5abac14c` passed: 400+ repository tests, 14/14 cube-specific tests, and browser smoke 1/1. Pre-merge **Run 664** passed on Ubuntu, Windows, and macOS-15-Intel. Post-merge **Run 665**, attempt 2, passed on all three platforms after a transient macOS runner hang on attempt 1.

The cube is **FROZEN** at `0216f3acd81331c031ac0ae023bfc1322f9064bc`.

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

### BOUNDED-FILE-CONTENT-READER-V0.1-SPEC

Filesystem Metadata / Stat Normalizer v0.1 is complete and frozen.

The next selected standalone product is:

**Bounded File Content Reader / Safe Content Access v0.1**

Rationale:

- provides a reusable safe primitive for bounded file-content access without absorbing traversal or indexing
- separates byte/text decoding semantics from metadata and directory walking
- makes memory, offset, cancellation, and decoding behavior explicit
- integrates Safe Path Resolver for root containment and Metadata Normalizer for stable entry context without re-owning either concern
- supports streaming and collected modes while preventing unbounded content disclosure through errors

### Immediate next task

Write and commit the complete SPEC at `specs/bounded-file-content-reader-safe-content-access-v0.1.md` before implementation begins.

The SPEC must lock:

- bounded byte/text APIs
- binary versus UTF-8 semantics
- Safe Path Resolver integration
- byte/line/work/time budgets
- streaming/chunked/collected memory behavior
- offset/length and EOF rules
- symlink policies
- BOM/newline/decoder policies
- filesystem capability seams and cleanup
- cancellation/deadline/backpressure
- changing-file semantics
- immutable deterministic results and privacy-safe diagnostics
- Ubuntu, Windows, macOS-15-Intel and relevant WSL verification
- zero-runtime-third-party-dependency boundary

No unrelated cube implementation starts before the SPEC gate is complete.

## Parked

All other capabilities remain parked until the current cube is released and frozen. New ideas must not bypass the one-current-task rule.
