# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Artifact Release Publication Confirmation / Outcome Receipt v0.1

PR #77 was squash-merged as `ee642ac4f760da6ee6263faa5e82bf7d197fa78d`. Pre-merge Run 573 passed on Ubuntu, Windows, and macOS-15-Intel after a minimal regression-fixture correction. Post-merge Run 574 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate.

The release hardened exact five-field closure identity linkage, deterministic plan/outcome linkage, bounded immutable confirmations, caller-supplied evidence/timestamps, optional bounded metadata, strict ISO-8601 normalization without system-clock access, SPC1 integrity protection, and fail-closed malformed/accessor/circular/oversized input handling.

### Artifact Release Publication Executor / Boundary v0.1

PR #76 was squash-merged as `23cf7b06e9162201683eb613d6c71c241cb5e34e`. Pre-merge Run 561 passed on Ubuntu, Windows, and macOS-15-Intel after a minimal accessor-regression fixture correction. Post-merge Run 562 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate.

### Artifact Release Closure Receipt / Finalization v0.1

PR #75 was squash-merged as `0e1adc1fc41924c4df14c5b10aa5ed1278297b90`. Pre-merge Run 555 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 556 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates. The Windows browser gate initially cancelled and was rerun independently; the rerun passed fully.

### Earlier released cubes

All earlier cubes remain released at their recorded immutable SHAs. The latest artifact-release chain is preserved in the commit history and individual release entries.

## Active milestone

### Runtime Capability Inspector v0.1

Selected as the next cube because the repository has strong local primitives for process, filesystem, configuration, and diagnostics but no standalone read-only capability-preflight product that composes those concepts into a bounded machine-readable environment contract. The new cube remains intentionally independent and does not call other Sovereign cubes.

Target:

- local runtime/host observation
- bounded executable availability checks without process execution
- deterministic declarative requirement evaluation
- immutable capability snapshots and verdicts
- typed fail-closed validation
- deterministic RCI1 checksum-protected serialization
- zero runtime third-party dependencies
- Ubuntu, Windows, macOS-15-Intel, and WSL verification

SPEC: `specs/runtime-capability-inspector-v0.1.md`

## Parked

Other capabilities remain parked. Do not expand Runtime Capability Inspector beyond its SPEC or begin another cube while this milestone is active.
