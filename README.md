# Sovereign Library

A collection of standalone, dependency-free software cubes for applications, tools, automations, agents, and products.

## Release rule

Each cube is independently usable, documented, tested, cross-platform, failure/recovery hardened, and replaceable.

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

## Dependency policy

Target: zero runtime third-party dependencies per cube. Standard libraries and native OS primitives are allowed foundations.

## Cross-platform target

Windows, Linux, macOS, and WSL where the capability is supported.

## Latest release

**Atomic Batch File Transaction / Safe Multi-File Commit v0.1** — PR #96, release commit `1fae6399eb2710b53cc8f53878138ae9a24a241d`.

Pre-merge Run #710 passed on Ubuntu, Windows, and macOS-15-Intel with syntax, full contract/integration tests, browser smoke, and complete jobs. Mainline Push Run #712 passed on all three platforms with every gate green.

The cube provides deterministic bounded multi-file transaction planning, preflight validation, owned staging, create/replace/delete operations, fail-closed rollback/recovery semantics, ABT1 integrity-protected immutable receipts, explicit guarantee levels, privacy-safe diagnostics, and zero runtime third-party dependencies. It does not claim universal multi-file atomicity or power-loss guarantees beyond explicitly reported filesystem capabilities.

**FROZEN** at `1fae6399eb2710b53cc8f53878138ae9a24a241d`.

## Latest corrective hardening

**File Lease / Advisory Lock v0.1** — corrective PR #95, release commit `a2eb715a558d9c88f19e9ff83ff512971e548891`.

The corrective hardening closes stale-successor ownership, orphan-lock recovery, and unexpected lock-directory release gaps.

**FROZEN** at `a2eb715a558d9c88f19e9ff83ff512971e548891`.

## Previous released cubes

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

Earlier Artifact Release cubes remain pinned in `ROADMAP.md`.

## Active milestone

**FILESYSTEM-PERMISSION-OWNERSHIP-DESCRIPTOR-SPEC**

The Atomic Batch File Transaction release is complete and frozen.

The next task is to write and freeze the SPEC for **Filesystem Permission / Ownership Descriptor v0.1** before any implementation begins.

The planned contract covers normalized cross-platform permission and ownership metadata, non-mutating inspection by default, capability detection, privacy-safe identifiers, deterministic immutable serialization, bounded metadata collection, explicit unsupported-platform/filesystem behavior, capability/data separation, failure/cancellation/recovery semantics, and zero runtime third-party dependencies.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material.
