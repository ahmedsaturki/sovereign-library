# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Filesystem Permission / Ownership Descriptor v0.1

PR #98 — release merge `69028a66b3827ecfee4a70f2460998dd333f02e0`

Release-candidate head: `463f1c539124fb54c449d1c15283e329d031abdb`

Final cross-platform **Run 727** passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs all green.

The cube is **FROZEN** at `69028a66b3827ecfee4a70f2460998dd333f02e0`.

The release closed tri-state portable permission semantics, explicit Windows readonly behavior, explicit ACL states, bounded deterministic platform flags, privacy-safe ownership classification, injected capability seams, fail-closed path/platform/capability validation, cancellation semantics, deterministic PPO1 serialization, and cross-platform CI observability hardening.

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

### BOUNDED-FILE-CONTENT-READER-SAFE-CONTENT-ACCESS-SPEC

The Filesystem Permission / Ownership Descriptor release is complete and frozen.

The next cube is **Bounded File Content Reader / Safe Content Access v0.1**. Existing work is present in PR #94 from an earlier project state, but it is not treated as release-ready. The next step is to read and freeze the current SPEC, compare it against the existing implementation/tests, identify drift, and apply only the smallest compliant delta.

The contract covers bounded binary/text reads, offsets and EOF behavior, strict UTF-8/BOM/newline policies, chunked streaming, cancellation/deadline, changing-file checks, explicit symlink policies, Safe Path Resolver anchoring, capability/data separation, privacy-safe diagnostics, guaranteed handle cleanup, failure/recovery semantics, and zero runtime third-party dependencies.

No implementation of another cube starts concurrently; the active milestone must complete the full release sequence before NEXT CUBE.
