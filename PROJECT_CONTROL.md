# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Release Manifest / Integrity Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Release / Verification Harness v0.1**
- Release PR: **#58**, squash-merged
- Release commit: `6e60d151691639948fabceaec1ee28964d40d881`
- Pre-merge verification: **Run 430**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 431**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Release / Verification Harness v0.1 is therefore **FROZEN**.
- The release provides deterministic local release-stage execution, safe native command invocation, bounded process output and diagnostics, timeout/cancellation/retry semantics, deterministic required/optional verdict aggregation, immutable machine-readable verification snapshots, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**RELEASE-MANIFEST-INTEGRITY-V0.1-SPEC**

### Immediate next task

Freeze and implement the public contract for a standalone deterministic release-manifest/integrity component:

1. canonical manifest normalization with stable ordering
2. deterministic file/entry descriptors and content digests
3. explicit manifest schema and versioning
4. reproducible manifest generation from bounded local inputs
5. integrity verification with precise mismatch reporting
6. immutable manifest and verification snapshots
7. fail-closed malformed manifests, unsafe paths, duplicates, and unsupported values
8. bounded entry count, path length, metadata size, and total manifest size
9. no hosted service, registry, signing provider, or external SDK requirement
10. zero runtime third-party dependencies
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, and runnable example before release

## Scope lock

For Release Manifest / Integrity Cube v0.1, allowed scope is only:

- local deterministic manifest generation
- canonical entry ordering and versioned manifest format
- content digest computation using native primitives
- integrity verification and deterministic mismatch reports
- bounded paths, entries, metadata, and payloads
- immutable public snapshots
- typed fail-closed errors
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- cryptographic signing or key management
- remote registries
- package publishing
- hosted artifact storage
- CI-provider integrations
- GUI/admin console
- network transport

## Definition of done

A milestone is DONE only when implementation, public API documentation, normal and failure-path tests, recovery behavior, examples, reproducible release state, cross-platform gates, and roadmap/control updates all pass.

## Anti-loop rules

- Do not redesign the whole architecture during a cube release.
- Do not add a dependency to solve a local problem without recording the decision.
- Do not start a second cube because the current cube is difficult.
- Do not expand scope because a competitor has more features.
- Do not call a cube production-ready from source inspection alone.
- Park out-of-scope work and continue.

## Lessons-learned rule

Every blocking bug or CI failure must produce root-cause identification, minimal fix, regression coverage, and a control/documentation update when the lesson affects future work.

## Clean-repository rule

`main` is the product branch. Temporary branches and PRs must not become runtime artifacts. Release merges should keep a clean, single-purpose history.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart from memory.

## Release sequence

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

No step may be skipped.
