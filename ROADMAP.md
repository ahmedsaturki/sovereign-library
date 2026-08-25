# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Latest released cube

### Runtime Capability Inspector / Preflight v0.1

PR #78 was squash-merged as `139a7d6c824b7fe522712c65e1b9ffcf605e134f`.

Pre-merge **Run 580** passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate.

Post-merge **Run 581** passed on `main` on Ubuntu, Windows, and macOS-15-Intel with the same gates.

The release provides bounded host/runtime facts, non-executing executable availability checks, immutable capability snapshots, pure declarative requirement evaluation, fail-closed malformed/accessor/circular/oversized input handling, deterministic `RCI1` integrity-protected serialization, and zero runtime third-party dependencies.

The cube is **FROZEN** at `139a7d6c824b7fe522712c65e1b9ffcf605e134f`.

### Previous release chain

Artifact Release Publication Confirmation / Outcome Receipt v0.1 — PR #77 — `ee642ac4f760da6ee6263faa5e82bf7d197fa78d`

Artifact Release Publication Executor / Boundary v0.1 — PR #76 — `23cf7b06e9162201683eb613d6c71c241cb5e34e`

Artifact Release Closure Receipt / Finalization v0.1 — PR #75 — `0e1adc1fc41924c4df14c5b10aa5ed1278297b90`

Earlier released cubes remain pinned to their recorded immutable SHAs.

## Active milestone

### NEXT-CUBE-SELECTION

The Runtime Capability Inspector release is complete and frozen. The next selected standalone product is:

**Filesystem Watcher / Change Stream v0.1**

Rationale:

- filesystem read/write primitives already exist, but temporal change observation is not a standalone product
- the capability is useful to editors, build systems, synchronization engines, caches, agents, and automations
- the boundary is independent: observe changes, normalize events, manage lifecycle, and apply explicit queue/backpressure behavior
- the core can be implemented with native platform facilities and standard-library primitives
- the cube remains read-only with respect to watched targets and does not execute commands, write configuration, or require another Sovereign cube

### Immediate next task

Write and commit the complete SPEC at `specs/filesystem-watcher-change-stream-v0.1.md` before starting implementation.

The SPEC must lock:

- normalized create/change/remove/rename event semantics
- lifecycle, close, error, and recovery behavior
- optional debounce/coalescing semantics
- bounded queue and explicit overflow/backpressure policy
- recursive watching and platform differences
- symlink and path containment rules
- duplicate/noise suppression rules that never invent events
- deterministic injected event source for contract tests
- cross-platform verification targets
- zero-runtime-third-party-dependency boundary

No implementation begins until this SPEC gate is complete.

## Parked

All other capabilities remain parked until the current cube is released and frozen. New ideas must not bypass the one-current-task rule.
