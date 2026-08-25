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

**Safe Path Resolver / Containment Boundary v0.1** — PR #90, release commit `0216f3acd81331c031ac0ae023bfc1322f9064bc`.

Exact-SHA external verification at `b52473ee8f4148932ec3d8526bbfe3ef5abac14c` passed with 400+ repository tests, 14/14 cube-specific tests, and browser smoke 1/1. Pre-merge Run #664 passed on Ubuntu, Windows, and macOS-15-Intel. Post-merge Run #665 passed on all three platforms on attempt 2 after a transient macOS runner hang on attempt 1.

The release provides deterministic lexical and filesystem-aware path resolution, explicit root anchoring and containment, traversal rejection, symlink policies with bounded depth, Windows drive/UNC/namespace handling, safe capability seams, SHA-256 SPR1 integrity protection, deterministic serialization, bounded inputs, failure/recovery semantics, and zero runtime third-party dependencies.

Earlier released cubes include Glob / Path Matcher, Host Identity / Environment Fingerprint, Directory Snapshot / Tree Manifest, Atomic File Writer / Safe Replace, Ephemeral Workspace / Scratch Directory, File Lease / Advisory Lock, Filesystem Watcher / Change Stream, Runtime Capability Inspector / Preflight, and the preceding Artifact Release series, all pinned in `ROADMAP.md`.

## Active milestone

**Directory Walker / Bounded Tree Traversal v0.1 SPEC** — the next standalone product.

It will own deterministic, bounded directory traversal using explicit file/directory/symlink/special-entry policies, root anchoring, traversal budgets, cancellation/backpressure, visitor and collected-result modes, and narrow filesystem capability seams. It will not absorb snapshot serialization, filesystem watching, glob matching, safe path policy, archive extraction, or persistent storage.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material.
