# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Canonical JSON / Normalization Cube v0.1** and release it before starting another cube.

## Current repository state

- Last released cube: **Diff / Patch v0.1**
- Release PR: **#48**, squash-merged
- Release merge commit: `e1acaeea3ec0b02da8998ac30a2f910e64aa2ade`
- Release-gate Run 345: completed pre-merge verification; Ubuntu and macOS-15-Intel passed, Windows was queued at merge time.
- Post-merge verification: **Run 347**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Diff / Patch v0.1 is therefore **FROZEN**.
- README and ROADMAP were updated to record the release and activate the next cube.
- Duplicate Redaction PR #47 remains closed as superseded by PR #45.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**CANONICAL-JSON-NORMALIZATION-V0.1-SPEC**

### Immediate next task

Freeze the public contract for a standalone native Canonical JSON / Normalization product:

1. define the supported JSON-safe value domain
2. define deterministic object-key ordering
3. define primitive serialization semantics, including negative zero and finite-number handling
4. define rejection semantics for unsupported values and accessor objects
5. define deterministic canonical JSON output
6. define bounded depth, node, string, and serialized-output limits
7. define immutable normalized output and immutable configuration
8. define typed fail-closed diagnostics without arbitrary payload copying
9. define source immutability guarantees
10. define unit, contract, integration, failure, and recovery gates
11. verify zero runtime third-party dependencies
12. write the standalone cube specification before implementation

## Scope lock

For Canonical JSON / Normalization Cube v0.1, the allowed scope is only:

- JSON-safe primitives, arrays, and plain objects
- deterministic object-key ordering
- stable primitive serialization rules
- explicit handling of negative zero and finite numbers
- strict rejection of unsupported values
- bounded depth, node count, string size, and serialized output size
- immutable normalized output
- immutable configuration
- deterministic canonical JSON serialization
- typed fail-closed errors with safe diagnostics
- source immutability
- local unit/contract/integration/failure/recovery tests
- cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- binary canonicalization formats
- cryptographic signing
- hashing APIs
- schema validation
- semantic normalization of dates, URLs, or domain-specific values
- network services
- third-party canonicalization packages

## Definition of done

A milestone is DONE only when:

- implementation exists
- public API is documented
- normal-path tests pass
- failure-path tests pass
- cleanup/restart behavior is verified where applicable
- supported-platform checks pass or documented capability limits exist
- example usage works
- release artifact is reproducible
- no known blocking defect remains
- `ROADMAP.md` is updated
- `PROJECT_CONTROL.md` points to the next active milestone

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
