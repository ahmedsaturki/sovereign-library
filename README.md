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

**Filesystem Recovery Journal / Operation Ledger v0.1** — PR #101, merge commit `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`.

Final pre-merge **Run #743** passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs green.

The cube provides deterministic FRJ1 append-only operation records, explicit lifecycle sequencing, bounded interrupted-operation inspection, explicit caller recovery decisions, integrity validation, immutable snapshots, persistence failure semantics, privacy-safe diagnostics, and zero runtime third-party dependencies. Recovery inspection never performs hidden filesystem mutation.

**FROZEN** at `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`.

## Previous recent releases

**Safe File Quarantine / Delete v0.1** — PR #100 — `699d4181f0775af93b62d78f47fb00de42ec346e`

**Bounded File Content Reader / Safe Content Access v0.1** — PR #99 — `f8db5a309aef655aec86051587bdf12d34f3dd20`

**Filesystem Permission / Ownership Descriptor v0.1** — PR #98 — `69028a66b3827ecfee4a70f2460998dd333f02e0`

**Atomic Batch File Transaction / Safe Multi-File Commit v0.1** — PR #96 — `1fae6399eb2710b53cc8f53878138ae9a24a241d`

Earlier releases remain pinned in `ROADMAP.md`.

## Active milestone

**NEXT-CUBE-SELECTION**

The Filesystem Recovery Journal / Operation Ledger release is complete and frozen. The next standalone cube is not yet selected.

The next gate is to inspect the current standalone-product inventory, parked specs, roadmap, branches and PR history; choose the next non-duplicative product supported by project evidence; and freeze its SPEC before implementation.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material.
