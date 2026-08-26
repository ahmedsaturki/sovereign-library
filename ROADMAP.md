# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Application Lifecycle / Graceful Shutdown Coordinator v0.1

PR #104 — release merge `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`

Final cross-platform **Run 768** passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs all green.

The cube is **FROZEN** at `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4` pending post-merge mainline verification.

The release provides deterministic participant registration/order, explicit application lifecycle state, one global shutdown transaction, global deadline with bounded participant timeouts, concurrent/idempotent shutdown semantics, cancellation, stale/late completion isolation, bounded outcomes/diagnostics, immutable snapshots/errors, capability/data separation, and zero runtime third-party dependencies.

### Process Supervisor / Managed Child Lifecycle v0.1

PR #102 — release merge `881435f121d09099b9b263fa906f0968c42e4539`

Final cross-platform **Run 760** passed on Ubuntu, Windows, and macOS-15-Intel.

The cube is **FROZEN** at `881435f121d09099b9b263fa906f0968c42e4539`.

### Filesystem Recovery Journal / Operation Ledger v0.1

PR #101 — release merge `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`

The cube is **FROZEN** at `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`.

### Safe File Quarantine / Delete v0.1

PR #100 — release merge `699d4181f0775af93b62d78f47fb00de42ec346e`

The cube is **FROZEN** at `699d4181f0775af93b62d78f47fb00de42ec346e`.

### Bounded File Content Reader / Safe Content Access v0.1

PR #99 — release merge `f8db5a309aef655aec86051587bdf12d34f3dd20`

The cube is **FROZEN** at `f8db5a309aef655aec86051587bdf12d34f3dd20`.

### Filesystem Permission / Ownership Descriptor v0.1

PR #98 — release merge `69028a66b3827ecfee4a70f2460998dd333f02e0`

The cube is **FROZEN** at `69028a66b3827ecfee4a70f2460998dd333f02e0`.

### Earlier released cubes

Earlier releases remain pinned in repository history and are listed in the release control documents.

## Active milestone

### NEXT-CUBE-SELECTION

**Application Lifecycle / Graceful Shutdown Coordinator v0.1** is complete and frozen after PR #104 / Run #768. The next Cube is not selected yet.

The next gate is a fresh inventory of the current standalone-product surface, parked specs, roadmap, branches, open PRs/issues, and existing implementations. Choose exactly one non-duplicative next Cube, freeze its SPEC, then implement it.

No second cube may start concurrently.
