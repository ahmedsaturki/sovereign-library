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

**Glob / Path Matcher v0.1** — PR #87, release commit `c9a3d330a16a488e00c28311085204363bab2fc7`.

Pre-merge Run #654 and post-merge Run #655 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.

The release provides pure cross-platform pattern compilation and matching, explicit `*`, `?`, and segment-level `**` semantics, escaping, separator normalization, explicit case and dotfile policies, traversal-safe normalization, deterministic rule precedence, bounded inputs, immutable matchers, and GPM1 integrity-protected serialization with zero runtime third-party dependencies.

Earlier released cubes include Host Identity / Environment Fingerprint, Directory Snapshot / Tree Manifest, Atomic File Writer / Safe Replace, Ephemeral Workspace / Scratch Directory, File Lease / Advisory Lock, Filesystem Watcher / Change Stream, Runtime Capability Inspector / Preflight, and the preceding Artifact Release series, all pinned in `ROADMAP.md`.

## Active milestone

**Safe Path Resolver / Containment Boundary v0.1 SPEC** — the next standalone product. It will own deterministic lexical and filesystem-aware path resolution, explicit root containment, traversal rejection, symlink policies, drive/UNC/namespace handling, and narrow filesystem capability seams without turning the pure comparison core into a filesystem walker.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material.
