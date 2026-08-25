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

**Host Identity / Environment Fingerprint v0.1** — PR #86, release commit `a7264db2b61c5cdc6ad33b04fc3a97c4fe47d24e`.

Pre-merge Run #644 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, HIF tests, and real-browser smoke. Post-merge Run #645 passed on Windows and macOS-15-Intel; its Ubuntu browser-smoke job experienced a transient runner hang and then passed when that exact job was independently rerun on the same release commit.

The release provides privacy-safe stable and volatile host identity fields, deterministic normalization and canonical serialization, explicit comparison semantics, bounded output, injectable capability seams, fail-closed malformed/accessor/circular input handling, and zero runtime third-party dependencies.

Earlier released cubes include Directory Snapshot / Tree Manifest, Atomic File Writer / Safe Replace, Ephemeral Workspace / Scratch Directory, File Lease / Advisory Lock, Filesystem Watcher / Change Stream, Runtime Capability Inspector / Preflight, and the preceding Artifact Release series, all pinned in `ROADMAP.md`.

## Active milestone

**Glob / Path Matcher v0.1 SPEC** — the next standalone product. It will own pure cross-platform path-pattern compilation and matching with explicit grammar, separator normalization, recursive `**` semantics, deterministic include/exclude precedence, explicit case policy, bounded complexity, and no filesystem side effects.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material.
