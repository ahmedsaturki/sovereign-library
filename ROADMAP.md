# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Process Supervisor / Managed Child Lifecycle v0.1

PR #102 — release merge `881435f121d09099b9b263fa906f0968c42e4539`

Final cross-platform **Run 760** passed on Ubuntu, Windows, and macOS-15-Intel with syntax, bounded contract/integration tests, browser smoke, and complete jobs all green.

The cube is **FROZEN** at `881435f121d09099b9b263fa906f0968c42e4539`.

The release adds one-child supervisor ownership, explicit lifecycle state, bounded graceful-to-forced stop escalation, opt-in restart budgets with deterministic backoff, stale-generation protection, read-only health inspection, bounded output/diagnostics, cancellation/deadline handling, immutable snapshots/errors, capability/data separation, and zero runtime third-party dependencies.

### Filesystem Recovery Journal / Operation Ledger v0.1

PR #101 — release merge `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`

Final cross-platform **Run 743** passed on Ubuntu, Windows, and macOS-15-Intel.

The cube is **FROZEN** at `7c197ce5e2d78b0dfaa36565b6c6897812c56ca2`.

### Safe File Quarantine / Delete v0.1

PR #100 — release merge `699d4181f0775af93b62d78f47fb00de42ec346e`

The cube is **FROZEN** at `699d4181f0775af93b62d78f47fb00de42ec346e`.

### Earlier released cubes

Earlier releases remain pinned in repository history and are listed in the release control documents.

## Active milestone

### APPLICATION-LIFECYCLE-SHUTDOWN-SPEC

**Application Lifecycle / Graceful Shutdown Coordinator v0.1** is the single active cube.

Selection evidence:
- lifecycle-aware cubes already own local close/drain behavior;
- no released cube coordinates multiple independent participants at application scope;
- no open PRs or issues cover this coordination boundary;
- the coordinator is deliberately scoped as orchestration only, not as a replacement for participant-owned shutdown semantics.

The frozen scope is recorded in `specs/application-lifecycle-graceful-shutdown-v0.1.md`.

The next gate is SPEC verification, then implementation, standalone documentation/example, package/test registration, and `TEST -> FIX -> VERIFY` across Ubuntu, Windows, and macOS-15-Intel.

No second cube may start concurrently.
