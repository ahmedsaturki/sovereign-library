# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Filesystem Recovery Journal / Operation Ledger v0.1

PR #101 — release merge `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`

Final cross-platform **Run 743** passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs all green.

The cube is **FROZEN** at `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`.

The release adds deterministic FRJ1 append-only operation records, explicit lifecycle sequencing, bounded interrupted-operation inspection, explicit caller recovery decisions, integrity validation, immutable snapshots, persistence failure semantics, privacy-safe diagnostics, and zero runtime third-party dependencies. Recovery inspection never performs hidden filesystem mutation.

### Safe File Quarantine / Delete v0.1

PR #100 — release merge `699d4181f0775af93b62d78f47fb00de42ec346e`

Final cross-platform **Run 738** passed on Ubuntu, Windows, and macOS-15-Intel.

The cube is **FROZEN** at `699d4181f0775af93b62d78f47fb00de42ec346e`.

### Bounded File Content Reader / Safe Content Access v0.1

PR #99 — release merge `f8db5a309aef655aec86051587bdf12d34f3dd20`

The cube is **FROZEN** at `f8db5a309aef655aec86051587bdf12d34f3dd20`.

### Filesystem Permission / Ownership Descriptor v0.1

PR #98 — release merge `69028a66b3827ecfee4a70f2460998dd333f02e0`

The cube is **FROZEN** at `69028a66b3827ecfee4a70f2460998dd333f02e0`.

### Earlier released cubes

Atomic Batch File Transaction / Safe Multi-File Commit v0.1 — PR #96 — `1fae6399eb2710b53cc8f53878138ae9a24a241d`

File Lease / Advisory Lock v0.1 — corrective PR #95 — `a2eb715a558d9c88f19e9ff83ff512971e548891`

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

Earlier Artifact Release cubes remain pinned in repository history.

## Active milestone

### NEXT-CUBE-SELECTION

The Filesystem Recovery Journal / Operation Ledger v0.1 release is complete and frozen.

The next cube has not yet been selected. The immediate task is to inspect the current standalone-product inventory, parked specs, roadmap, branches and PR history, and select the next non-duplicative standalone product supported by project evidence; then freeze its SPEC before implementation.

No implementation of another cube starts concurrently.
