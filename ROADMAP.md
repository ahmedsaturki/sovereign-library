# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Atomic Batch File Transaction / Safe Multi-File Commit v0.1

PR #96 — `1fae6399eb2710b53cc8f53878138ae9a24a241d`

Pre-merge **Run 710** passed on Ubuntu, Windows, and macOS-15-Intel with syntax, full contract/integration tests, browser smoke, and complete jobs all green.

Mainline Push verification **Run 712** passed on Ubuntu, Windows, and macOS-15-Intel with syntax, full tests, browser smoke, and complete jobs all green.

The cube is **FROZEN** at `1fae6399eb2710b53cc8f53878138ae9a24a241d`.

Hardening closed absolute-root enforcement, proof-gated `strong-local` capability claims, truthful post-cleanup rollback availability, immutable ABT1 receipts, bounded planning, and fail-closed recovery.

### File Lease / Advisory Lock v0.1 — corrective hardening

Corrective PR #95 — `a2eb715a558d9c88f19e9ff83ff512971e548891`

Run 700 and Run 701 passed across the supported matrix after targeted macOS reruns.

The corrective release is **FROZEN** at `a2eb715a558d9c88f19e9ff83ff512971e548891`.

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

## Active milestone

### FILESYSTEM-PERMISSION-OWNERSHIP-DESCRIPTOR-SPEC

The Atomic Batch File Transaction release is complete and frozen.

The next task is to write and freeze the SPEC for **Filesystem Permission / Ownership Descriptor v0.1**.

The SPEC must define:

- normalized cross-platform permission and ownership metadata
- non-mutating inspection as the default behavior
- explicit capability detection for supported mutation features, if any
- privacy-safe treatment of user/group identifiers
- deterministic serialization and immutable descriptors
- unsupported-platform and unsupported-filesystem behavior
- bounded work and metadata collection
- capability/data separation and accessor safety
- failure, cancellation, and recovery semantics
- zero runtime third-party dependencies

No implementation begins until the SPEC is committed and the control plane records the SPEC gate as complete.

## Parked

All other capabilities remain parked until the current cube release and the active SPEC gate are complete. New ideas must not bypass the one-current-task rule.
