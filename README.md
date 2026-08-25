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

**Directory Walker / Bounded Tree Traversal v0.1** — PR #92, release commit `4d64f6610286524799ebe809021279a7b7be3d40`.

Pre-merge Run #674 and post-merge Run #675 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.

The release provides deterministic frame-based traversal, bounded depth/entries/work, visitor backpressure, collected-result mode, cancellation/deadlines, explicit symlink policies, canonical-root containment, bounded symlink depth, immutable results, fail-closed capability seams, and zero runtime third-party dependencies.

Earlier released cubes include Safe Path Resolver / Containment Boundary, Glob / Path Matcher, Host Identity / Environment Fingerprint, Directory Snapshot / Tree Manifest, Atomic File Writer / Safe Replace, Ephemeral Workspace / Scratch Directory, File Lease / Advisory Lock, Filesystem Watcher / Change Stream, Runtime Capability Inspector / Preflight, and the preceding Artifact Release series, all pinned in `ROADMAP.md`.

## Active milestone

**Filesystem Metadata / Stat Normalizer v0.1 SPEC** — the next standalone product.

It will own deterministic normalization of `lstat`/`stat` metadata across POSIX and Windows, with explicit symlink and platform-field policies, bounded immutable metadata, privacy-safe allowlisting, capability seams, deterministic canonical representation, and failure/recovery behavior for missing, permission-denied, malformed, or changing entries. It will not own traversal, snapshots, persistence, watching, glob matching, or path containment.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material.
