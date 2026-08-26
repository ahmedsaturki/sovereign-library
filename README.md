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

**Application Lifecycle / Graceful Shutdown Coordinator v0.1** — PR #104, merge commit `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`.

Final pre-merge **Run #768** passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs green.

Post-merge **Run #772** also passed on Ubuntu, Windows, and macOS-15-Intel.

The cube provides deterministic participant registration and ordering, explicit application lifecycle state, one global shutdown transaction, global deadline with bounded participant timeouts, concurrent/idempotent shutdown semantics, cancellation, stale/late completion isolation, bounded outcomes/diagnostics, immutable snapshots/errors, capability/data separation, native Node.js primitives, and zero runtime third-party dependencies.

**FROZEN** at `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`.

## Previous recent releases

**Process Supervisor / Managed Child Lifecycle v0.1** — PR #102 — `881435f121d09099b9b263fa906f0968c42e4539`

**Filesystem Recovery Journal / Operation Ledger v0.1** — PR #101 — `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`

**Safe File Quarantine / Delete v0.1** — PR #100 — `699d4181f0775af93b62d78f47fb00de42ec346e`

**Bounded File Content Reader / Safe Content Access v0.1** — PR #99 — `f8db5a309aef655aec86051587bdf12d34f3dd20`

**Filesystem Permission / Ownership Descriptor v0.1** — PR #98 — `69028a66b3827ecfee4a70f2460998dd333f02e0`

**Atomic Batch File Transaction / Safe Multi-File Commit v0.1** — PR #96 — `1fae6399eb2710b53cc8f53878138ae9a24a241d`

Earlier releases remain pinned in `ROADMAP.md`.

## Phase 0 — Stabilization & Package Readiness

**Inventory & Classification** is complete and frozen after PR #105 / Run #773.

The current gate is **Apache License 2.0 adoption and repository distribution policy**. This establishes licensing for future distributable components but does not authorize npm publication by itself.

After licensing, Phase 0 proceeds through API boundary freeze, type/declaration strategy, package contract/tooling, reproducible packaging/security verification, and only then a small first public package batch.

## License

This repository is distributed under the **Apache License, Version 2.0**. See `LICENSE` and `NOTICE`.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```
