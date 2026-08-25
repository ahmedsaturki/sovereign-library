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

**Filesystem Metadata / Stat Normalizer v0.1** — PR #93, release commit `44f1acc2f277a2016013146423bd97a7a4e15057`.

Pre-merge Run #681 and post-merge Run #682 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, 641 repository tests, and real-browser smoke.

The release provides deterministic FMN1 metadata normalization, lstat/stat/contained symlink policies, safe numeric and timestamp normalization, immutable bounded records, privacy-safe coarse platform data, typed recovery policies, SHA-256 integrity-protected canonical serialization, and zero runtime third-party dependencies.

Earlier released cubes include Directory Walker / Bounded Tree Traversal, Safe Path Resolver / Containment Boundary, Glob / Path Matcher, Host Identity / Environment Fingerprint, Directory Snapshot / Tree Manifest, Atomic File Writer / Safe Replace, Ephemeral Workspace / Scratch Directory, File Lease / Advisory Lock, Filesystem Watcher / Change Stream, Runtime Capability Inspector / Preflight, and the preceding Artifact Release series, all pinned in `ROADMAP.md`.

## Active milestone

**Bounded File Content Reader / Safe Content Access v0.1 SPEC** — the next standalone product.

It will own bounded binary/text file reads with explicit decoding, offsets, EOF semantics, memory/time/work budgets, streaming and collected modes, Safe Path Resolver integration, symlink policy, cancellation/backpressure, changing-file semantics, and privacy-safe diagnostics. It will not own traversal, metadata normalization, snapshots, watching, glob matching, persistence, archive extraction, or indexing/search.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material.
