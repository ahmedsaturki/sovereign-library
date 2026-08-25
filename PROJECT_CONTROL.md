# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Diff / Patch Cube v0.1** and release it before starting another cube.

## Current repository state

- Last released cube: **Redaction / Secret Safety v0.1**
- Release PR: **#45**, squash-merged
- Release commit: `e1040a0464f10f6e20d2ed39b5dd2e9097edae83`
- Latest main commit: `907680fd2f2c8c7c2fa8c3a3a6e30a81c8b00878`
- Latest main commit: `docs: release redaction and advance diff patch milestone`
- Latest release-gate CI: **Run 341**, passed on Ubuntu, Windows, and macOS-15-Intel with full repository tests and real-browser smoke
- Post-release verification: **Run 342** initially exposed one macOS-15-Intel timing-sensitive Worker Pool timeout test; failed jobs were re-run and the retry is currently in progress. No Redaction regression was observed.
- Duplicate Redaction PR #47 was closed as superseded by PR #45.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**DIFF-PATCH-V0.1-RELEASE**

### Immediate next task

Build and release a standalone native Diff / Patch product:

1. freeze JSON-safe value and path semantics
2. define deterministic structural diff operations
3. define strict path validation and operation ordering
4. implement immutable diff output
5. implement bounded operation/depth/value limits
6. implement deterministic patch application
7. reject malformed, unsafe, ambiguous, or conflicting patch operations
8. guarantee source immutability for both diff and patch
9. expose safe typed diagnostics without leaking arbitrary payloads
10. verify zero runtime third-party dependencies
11. add unit, contract, integration, failure, and recovery tests
12. run the supported cross-platform CI matrix and real-browser smoke gate
13. fix only failures required for the v0.1 gate
14. squash-merge the release PR
15. update `ROADMAP.md` and freeze the cube before starting another milestone

## Scope lock

For Diff / Patch Cube v0.1, the allowed scope is only:

- JSON-safe primitives, arrays, and plain objects
- deterministic structural diff generation
- deterministic patch operation format
- add/remove/replace operations
- strict path parsing and validation
- bounded operation count and traversal depth
- bounded string/value sizes
- immutable diff results
- immutable patch results
- source immutability
- deterministic operation ordering
- conflict/ambiguity rejection
- typed errors and safe diagnostics
- local unit/contract/integration/failure/recovery tests
- cross-platform verification

Explicitly out of scope for v0.1:

- binary diff formats
- filesystem patching
- text/line-oriented patching
- merge/conflict resolution between independent branches
- three-way merge
- network synchronization
- external diff/patch services
- third-party diff/patch packages

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
