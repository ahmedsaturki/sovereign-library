# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### File Lease / Advisory Lock v0.1

PR #80 was squash-merged as `b3d4f1dc61a6ed64d642fc0a9a92466c01da2868`.

Pre-merge **Run 607** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, 522/522 full repository tests, and the real-browser smoke gate.

Post-merge **Run 608** passed on `main` across Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate.

The release provides atomic sidecar-directory advisory ownership, bounded immutable lease identity and owner metadata, optional TTL/renewal, conservative stale recovery, successor-owner-safe release semantics, FLC1 checksum-protected lock records, deterministic capability seams, fail-closed input handling, and zero runtime third-party dependencies.

The cube is **FROZEN** at `b3d4f1dc61a6ed64d642fc0a9a92466c01da2868`.

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

### EPHEMERAL-WORKSPACE-SCRATCH-DIRECTORY-V0.1-SPEC

The File Lease / Advisory Lock release is complete and frozen. The next selected standalone product is:

**Ephemeral Workspace / Scratch Directory v0.1**

Rationale:

- local temporary workspace management is a distinct lifecycle capability not owned by File Lease or Filesystem Watcher
- the capability is useful to build systems, agents, document pipelines, browser/task isolation, and one-shot automations
- the boundary is independent: create, identify, contain, clean up, expire, and recover a local ephemeral workspace
- native filesystem primitives are sufficient for the core without third-party runtime dependencies
- ownership and cleanup semantics can remain content-neutral and do not require a database or network service

### Immediate next task

Write and commit the complete SPEC at `specs/ephemeral-workspace-scratch-directory-v0.1.md` before implementation begins.

The SPEC must lock:

- standalone workspace lifecycle and public API
- safe unique workspace creation without following attacker-controlled paths
- bounded ownership metadata and workspace identity
- cleanup and idempotent release behavior
- optional TTL/expiry semantics without timestamp-only ownership claims
- conservative stale/orphan recovery rules
- path containment and symlink boundary behavior
- deterministic test seams for filesystem, clock, and identity capabilities
- Ubuntu, Windows, macOS-15-Intel, and relevant WSL verification boundaries
- zero-runtime-third-party-dependency boundary

No unrelated cube implementation starts before the SPEC gate is complete.

## Parked

All other capabilities remain parked until the current cube is released and frozen. New ideas must not bypass the one-current-task rule.
