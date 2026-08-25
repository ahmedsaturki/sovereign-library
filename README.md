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

**Directory Snapshot / Tree Manifest v0.1** — PR #85, release commit `c01cc08e97404d1528fb93d6728fd2ae272871c3`.

Pre-merge Run #633 and post-merge Run #635 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.

The release provides deterministic directory inventory, explicit file/directory/symlink representation, bounded traversal, symlink containment and cycle protection, optional content digesting, mutation/error policies, canonical serialization, immutable read-only snapshots, and zero runtime third-party dependencies.

Earlier released cubes include Atomic File Writer / Safe Replace, Ephemeral Workspace / Scratch Directory, File Lease / Advisory Lock, Filesystem Watcher / Change Stream, Runtime Capability Inspector / Preflight, and the preceding Artifact Release series, all pinned in `ROADMAP.md`.

## Active milestone

**Host Identity / Environment Fingerprint v0.1 SPEC** — the next standalone product. It will own privacy-safe local host/environment identity data, stable-vs-volatile classification, deterministic normalization/serialization, bounded fingerprints, and comparison semantics without reading secrets, extracting credentials, or performing remote discovery.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material.
