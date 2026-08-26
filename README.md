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

**Safe File Quarantine / Delete v0.1** — PR #100, merge commit `699d4181f0775af93b62d78f47fb00de42ec346e`.

Final pre-merge Run #738 passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs green. Post-merge Run #739 and control-plane Run #740 also passed on all three platforms.

The cube provides quarantine-first destructive boundaries, exact receipt-bound restore, explicit permanent purge, SFQ1 integrity-protected manifests, containment and symlink safety, native rename-only movement, bounded rollback/cleanup recovery, immutable receipts, privacy-safe diagnostics, and zero runtime third-party dependencies.

**FROZEN** at `699d4181f0775af93b62d78f47fb00de42ec346e`.

## Previous recent releases

**Bounded File Content Reader / Safe Content Access v0.1** — PR #99 — `f8db5a309aef655aec86051587bdf12d34f3dd20`

**Filesystem Permission / Ownership Descriptor v0.1** — PR #98 — `69028a66b3827ecfee4a70f2460998dd333f02e0`

**Atomic Batch File Transaction / Safe Multi-File Commit v0.1** — PR #96 — `1fae6399eb2710b53cc8f53878138ae9a24a241d`

Earlier releases remain pinned in `ROADMAP.md`.

## Active milestone

**FILESYSTEM-RECOVERY-JOURNAL-IMPLEMENT**

The next standalone cube is **Filesystem Recovery Journal / Operation Ledger v0.1**. Its SPEC is frozen on the active feature branch before implementation.

The cube provides explicit bounded operation intents, deterministic lifecycle sequencing, integrity-protected FRJ1 records, interrupted-operation inspection, explicit recovery decisions, immutable snapshots, persistence failure semantics, privacy-safe diagnostics, and zero runtime third-party dependencies. Recovery inspection never performs hidden filesystem mutation.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material.
