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

**Bounded File Content Reader / Safe Content Access v0.1** — PR #94, release commit `277cb8f4d1e8278fe31c8dc7d3269c5c9bbeee99`.

Pre-merge Run #693 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, **661/661 tests**, and real-browser smoke. Post-merge Run #694 passed on the release commit. Mainline Run #695 had a transient macOS-15-Intel Node.js test-runner hang; after fresh reruns, macOS Job `98006586509` passed in 34s with syntax, contract/integration tests, browser smoke, and complete job all green, while Ubuntu and Windows also passed.

The release provides bounded binary/text file access with explicit UTF-8 semantics, root anchoring through Safe Path Resolver, bounded memory/work/time behavior, streaming and collected modes, explicit offset/length/EOF rules, symlink policies, BOM/newline/decoder policies, capability seams for open/read/stat/close, cancellation and cleanup semantics, changing-file handling, immutable deterministic results, privacy-safe diagnostics, and zero runtime third-party dependencies.

**FROZEN** at `277cb8f4d1e8278fe31c8dc7d3269c5c9bbeee99`.

## Latest corrective hardening

**File Lease / Advisory Lock v0.1** — corrective PR #95, release commit `a2eb715a558d9c88f19e9ff83ff512971e548891`.

Run #700 passed on Ubuntu, Windows, and macOS-15-Intel after a macOS-only rerun. Mainline Run #701 initially cancelled the macOS job after an infrastructure hang; the same macOS job was then rerun on a fresh runner and passed syntax, full tests, browser smoke, and complete job. Ubuntu and Windows passed on the original mainline attempt.

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

**ATOMIC-BATCH-FILE-TRANSACTION-SPEC**

The File Lease / Advisory Lock review is complete and the corrective release is frozen.

The next task is to write and freeze the SPEC for **Atomic Batch File Transaction / Safe Multi-File Commit v0.1** before any implementation begins.

The planned contract covers deterministic operation planning, preflight validation, owned temporary files, safe multi-file replacement semantics, rollback and crash/interruption recovery boundaries, containment/symlink policies, bounded resource usage, capability seams, immutable integrity-protected receipts, privacy-safe diagnostics, explicit unsupported platform/filesystem behavior, and zero runtime third-party dependencies.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material.
