# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Filesystem Watcher / Change Stream v0.1

PR #79 was merged as `239e418e620d06de5d25a9c40905f6efc42334b3`.

Post-merge **Run 598** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate.

The release provides a read-only native filesystem change stream, deterministic injected event sources, immutable bounded events, explicit overflow policies, lifecycle/recovery behavior, bounded debounce with terminal-event draining, root/path containment, and Windows native watch-path hardening with zero runtime third-party dependencies.

The cube is **FROZEN** at `239e418e620d06de5d25a9c40905f6efc42334b3`.

### Runtime Capability Inspector / Preflight v0.1

PR #78 was squash-merged as `139a7d6c824b7fe522712c65e1b9ffcf605e134f4`.

Pre-merge **Run 580** and post-merge **Run 581** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.

### Previous release chain

Artifact Release Publication Confirmation / Outcome Receipt v0.1 — PR #77 — `ee642ac4f760da6ee6263faa5e82bf7d197fa78d`

Artifact Release Publication Executor / Boundary v0.1 — PR #76 — `23cf7b06e9162201683eb613d6c71c241cb5e34e`

Artifact Release Closure Receipt / Finalization v0.1 — PR #75 — `0e1adc1fc41924c4df14c5b10aa5ed1278297b90`

Earlier released cubes remain pinned to their recorded immutable SHAs.

## Active milestone

### FILE-LEASE-ADVISORY-LOCK-V0.1-SPEC

The Filesystem Watcher / Change Stream release is complete and frozen. The next selected standalone product is:

**File Lease / Advisory Lock v0.1**

Rationale:

- filesystem primitives already exist, but cooperative resource ownership is not a standalone product
- the capability is useful for single-instance guards, job exclusion, agent/workspace ownership, build coordination, and maintenance locks
- the boundary is independent: acquire, verify, renew, recover conservatively, and release one local advisory lease
- native filesystem atomicity provides the core without third-party dependencies
- the cube can remain content-neutral and read-only with respect to the protected resource
- failure-safe semantics are valuable for the larger Sovereign runtime without making this cube depend on other cubes

### Immediate next task

Implement the public contract defined in `specs/file-lease-advisory-lock-v0.1.md` from branch `file-lease-advisory-lock-v0-1`.

The SPEC locks:

- atomic ownership establishment
- acquisition/busy/recovery outcomes
- explicit lease identity and bounded owner metadata
- optional TTL and renewal
- conservative stale recovery
- exact-owner release and successor-owner protection
- versioned integrity-protected lock records
- bounded paths/metadata/records and fail-closed validation
- Ubuntu, Windows, macOS-15-Intel, and WSL verification boundaries
- zero-runtime-third-party-dependency boundary

No unrelated cube implementation starts before this cube reaches FREEZE.

## Parked

All other capabilities remain parked until the current cube is released and frozen. New ideas must not bypass the one-current-task rule.
