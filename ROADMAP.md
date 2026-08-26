# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Bounded File Content Reader / Safe Content Access v0.1

PR #99 — release merge `f8db5a309aef655aec86051587bdf12d34f3dd20`

Release-candidate head: `8c0c7c6455ba617bfcd8d7116b46adce66681d93`

Final cross-platform **Run 734** passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs all green.

The cube is **FROZEN** at `f8db5a309aef655aec86051587bdf12d34f3dd20`.

The release hardens bounded binary/text reads, offsets and EOF semantics, strict UTF-8/BOM/newline policies, ordered chunk streaming, work/deadline/cancellation boundaries, explicit symlink and changing-file behavior, Safe Path Resolver anchoring, capability/data separation, bounded privacy-safe diagnostics, cleanup-safe failure handling, immutable results, and zero runtime third-party dependencies.

### Filesystem Permission / Ownership Descriptor v0.1

PR #98 — release merge `69028a66b3827ecfee4a70f2460998dd333f02e0`

Release-candidate head: `463f1c539124fb54c449d1c15283e329d031abdb`

Final cross-platform **Run 727** passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs all green.

The cube is **FROZEN** at `69028a66b3827ecfee4a70f2460998dd333f02e0`.

### Atomic Batch File Transaction / Safe Multi-File Commit v0.1

PR #96 — `1fae6399eb2710b53cc8f53878138ae9a24a241d`

Pre-merge **Run 710** and Mainline Push **Run 712** passed on Ubuntu, Windows, and macOS-15-Intel.

The cube is **FROZEN** at `1fae6399eb2710b53cc8f53878138ae9a24a241d`.

### File Lease / Advisory Lock v0.1 — corrective hardening

Corrective PR #95 — `a2eb715a558d9c88f19e9ff83ff512971e548891`

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

### SAFE-FILE-QUARANTINE-DELETE-IMPLEMENT

Safe File Quarantine / Delete v0.1 is the active cube. Its SPEC is frozen and implementation/testing are in progress on branch `feat/safe-file-quarantine-delete-v0-1`.

The cube provides quarantine-first mutation, exact receipt-bound restore, explicit permanent purge from quarantine, integrity-protected manifests, source/quarantine containment, symlink rejection, collision protection, native rename-only movement, bounded rollback/cleanup recovery, immutable receipts, privacy-safe diagnostics, and zero runtime third-party dependencies.

The next gate is package/test registration followed by `TEST -> FIX -> VERIFY` across Ubuntu, Windows, and macOS-15-Intel.
