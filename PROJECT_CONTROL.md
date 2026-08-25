# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish and freeze **Diff / Patch Cube v0.1** before starting another cube.

## Current repository state

- Last released cube before current gate: **Redaction / Secret Safety v0.1**
- Current release PR: **#48**, squash-merged
- Current release merge commit: `e1acaeea3ec0b02da8998ac30a2f910e64aa2ade`
- Diff / Patch branch head released into main: `1e7e37c0254fd107ec4b9bc46d689fcc6617ca2d`
- Latest main feature merge: `e1acaeea3ec0b02da8998ac30a2f910e64aa2ade`
- Release-gate Run 345: Ubuntu and macOS-15-Intel passed syntax, full repository tests, and real-browser smoke; the Windows job remained queued when GitHub completed the merge.
- Post-merge verification is therefore required before FREEZE and before the repository is advanced to the next cube.
- Earlier release-gate Run 341 for Redaction passed on Ubuntu, Windows, and macOS-15-Intel.
- Duplicate Redaction PR #47 was closed as superseded by PR #45.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**DIFF-PATCH-V0.1-FREEZE-GATE**

### Immediate next task

Verify the merged Diff / Patch Cube on `main` across the supported CI matrix and complete the freeze:

1. run the post-merge repository verification on `main`
2. require syntax, full repository tests, failure/recovery tests, and real-browser smoke to pass
3. require Ubuntu, Windows, and macOS-15-Intel verification to pass
4. record any blocking failure with root cause, minimal fix, and regression protection
5. update `ROADMAP.md` with the final release record
6. update `README.md` to reflect the released cube
7. freeze Diff / Patch v0.1
8. activate exactly one next cube and exactly one immediate next task

## Diff / Patch v0.1 scope that has been implemented

- JSON-safe primitives, arrays, and plain objects
- deterministic structural diff generation
- deterministic add/remove/replace operation format
- strict JSON Pointer path parsing and escaping
- bounded operation count, traversal depth, node count, string size, and serialized value size
- immutable diff results
- persistent immutable patch application
- source immutability
- deterministic object ordering
- conflict and ambiguity rejection
- typed fail-closed diagnostics without arbitrary payload copying
- circular-reference detection before recursive traversal
- zero runtime third-party dependencies
- public documentation and runnable example
- unit, contract, integration, failure, and recovery coverage

## Explicitly out of scope for Diff / Patch v0.1

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
