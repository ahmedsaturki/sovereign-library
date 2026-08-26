# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Bounded File Content Reader / Safe Content Access v0.1

PR #94 — `277cb8f4d1e8278fe31c8dc7d3269c5c9bbeee99`

Pre-merge **Run 693** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, **661/661 tests**, and real-browser smoke. Post-merge **Run 694** passed on the release commit. Mainline Push verification **Run 695** experienced a transient macOS-15-Intel Node.js test-runner hang, resolved by a fresh-run pass (macOS Job `98006586509`, 34s) with syntax, contract/integration tests, browser smoke, and complete job all green. No product-code or workflow changes were required.

The cube is **FROZEN** at `277cb8f4d1e8278fe31c8dc7d3269c5c9bbeee99`.

### File Lease / Advisory Lock v0.1 — corrective hardening

Corrective PR #95 — `a2eb715a558d9c88f19e9ff83ff512971e548891`

PR verification **Run 700** passed on Ubuntu, Windows, and macOS-15-Intel after a macOS-only rerun. Mainline Push verification **Run 701** initially cancelled the macOS-15-Intel job after a runner hang; the same macOS job was rerun on a fresh runner and passed syntax, full tests, browser smoke, and complete job. Ubuntu and Windows passed on the original mainline attempt.

The corrective release is **FROZEN** at `a2eb715a558d9c88f19e9ff83ff512971e548891`.

Hardening closed three contract gaps: stale-recovered successor ownership invalidates the old lease object; orphan lock directories without an owner record fail closed; and release refuses to report success while unexpected lock-directory entries remain.

### Earlier released cubes

Filesystem Metadata / Stat Normalizer v0.1 — PR #93 — `44f1acc2f277a2016013146423bd97a7a4e15057`

Directory Walker / Bounded Tree Traversal v0.1 — PR #92 — `4d64f6610286524799ebe809021279a7b7be3d40`

Safe Path Resolver / Containment Boundary v0.1 — PR #90 — `0216f3acd81331c031ac0ae023bfc1322f9064bc`

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

### ATOMIC-BATCH-FILE-TRANSACTION-SPEC

The File Lease / Advisory Lock review is complete and its corrective release is frozen.

The next task is to write and freeze the SPEC for **Atomic Batch File Transaction / Safe Multi-File Commit v0.1**.

The SPEC must define:

- deterministic operation planning and canonical ordering
- preflight validation before mutation
- owned temporary files and cleanup
- safe replacement semantics for multiple local files
- rollback and recovery after partial failure
- interruption/crash recovery boundaries and explicit unsupported guarantees
- containment and symlink policy
- bounded entry, byte, and work budgets
- capability seams for filesystem operations, identity, clock, and failure injection
- immutable deterministic commit/rollback receipts with integrity protection
- privacy-safe bounded diagnostics
- explicit platform/filesystem capability reporting
- zero runtime third-party dependencies

No implementation begins until the SPEC is committed and the control plane records the SPEC gate as complete.

## Parked

All other capabilities remain parked until the current cube release is complete. New ideas must not bypass the one-current-task rule.
