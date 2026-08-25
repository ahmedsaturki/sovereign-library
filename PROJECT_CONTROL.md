# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Glob / Path Matcher v0.1**.

## Current repository state

- Last released cube: **Glob / Path Matcher v0.1**
- Release PR: **#87**, squash-merged
- Release commit: `c9a3d330a16a488e00c28311085204363bab2fc7`
- Pre-merge verification: **Run 654**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 655**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Glob / Path Matcher v0.1 is **FROZEN** at `c9a3d330a16a488e00c28311085204363bab2fc7`.
- Blocking fixes included escape-tokenization ordering and explicit absolute-root anchoring; regression coverage was added and the final platform matrix passed without workflow bypasses.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**SAFE-PATH-RESOLVER-V0.1-SPEC**

### Immediate next task

Write and commit the complete SPEC for **Safe Path Resolver / Containment Boundary v0.1** before implementation begins.

The SPEC must lock:

1. standalone cross-platform path resolution and containment API
2. lexical normalization versus filesystem-aware canonicalization semantics
3. absolute, relative, drive, UNC, and root behavior
4. explicit base/root scope anchoring
5. traversal (`..`) handling and escape rejection
6. symlink-aware versus lexical-only resolution policies
7. Windows namespace and volume-boundary handling
8. deterministic comparison semantics independent of host OS defaults
9. bounded path length, segment count, and recursion limits
10. capability seams for filesystem-aware resolution without leaking executable objects into data validation
11. failure/recovery behavior and non-mutating guarantees
12. Ubuntu, Windows, macOS-15-Intel, and relevant WSL verification
13. zero-runtime-third-party-dependency boundary

No implementation starts before the SPEC exists on the control plane.

## Scope lock

The next cube owns safe path resolution, containment, and comparison semantics. It does not own glob matching, directory traversal, snapshotting, filesystem watching, archive extraction, shell expansion, shell execution, or persistent storage.

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
