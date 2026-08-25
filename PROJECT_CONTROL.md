# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Serialization / Binary Codec Cube v0.1** and release it before starting another cube.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**SERIALIZATION-BINARY-CODEC-V0.1-RELEASE**

### Immediate next task

Build and release a native bounded binary serialization primitive:

1. freeze supported value types and wire-format rules
2. implement deterministic encoding with explicit type tags
3. implement bounded decoding with depth and payload limits
4. reject unsupported values before encoding
5. normalize decode/encode failures into deterministic typed errors
6. guarantee round-trip fidelity for supported values
7. verify zero runtime third-party dependencies
8. run the supported cross-platform CI matrix
9. fix only failures required for the v0.1 gate
10. squash-merge the release PR
11. update ROADMAP before starting another cube

## Scope lock

For Serialization / Binary Codec Cube v0.1, the allowed scope is only:

- null/boolean/number/string values
- bounded arrays
- bounded plain objects with string keys
- explicit type tags
- deterministic key ordering
- bounded nesting depth
- bounded encoded payload size
- deterministic typed encode/decode errors
- immutable configuration snapshots
- byte-oriented APIs
- local unit/integration/failure/recovery tests
- cross-platform verification

Explicitly out of scope for v0.1:

- arbitrary class instances
- functions
- symbols
- WeakMap/WeakSet
- executable or eval-based decoding
- schema registry
- compression
- encryption
- third-party serialization packages
- distributed protocol negotiation

## Definition of done

A milestone is DONE only when:

- implementation exists
- public API is documented
- normal-path tests pass
- failure-path tests pass
- cleanup/restart behavior is verified
- supported-platform checks pass or documented capability limits exist
- example usage works
- release artifact is reproducible
- no known blocking defect remains
- ROADMAP is updated

## Anti-loop rules

- Do not redesign the whole architecture during a cube release.
- Do not add a new dependency to solve a local problem without recording the decision.
- Do not start a second cube because the current cube is difficult.
- Do not expand scope because a competitor has more features.
- Do not call a cube production-ready from source inspection alone.
- If a problem is outside the active scope, park it and continue.

## Lessons-learned rule

Every blocking bug or CI failure must produce all of the following before release:

- root-cause identification
- minimal fix
- regression test
- CI protection when applicable
- documentation or control update when the lesson affects future work

## Clean-repository rule

`main` is the product branch. Temporary verification branches and PRs must not become runtime artifacts. Release merges should prefer a clean, single-purpose history. No marker files, generated dependency trees, vendor directories, or unused compatibility layers belong in the product.

## Decision rule

When uncertain, choose the smallest implementation that satisfies the current contract and can later be replaced without breaking consumers.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart the project from memory.

## Release sequence

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

No step may be skipped by calling the project complete early.
