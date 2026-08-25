# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Host Identity / Environment Fingerprint v0.1**.

## Current repository state

- Last released cube: **Host Identity / Environment Fingerprint v0.1**
- Release PR: **#86**, squash-merged
- Release commit: `a7264db2b61c5cdc6ad33b04fc3a97c4fe47d24e`
- Pre-merge verification: **Run 644**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, HIF tests, and real-browser smoke.
- Post-merge verification: **Run 645**, Windows and macOS-15-Intel passed on the original attempt; Ubuntu browser smoke experienced a transient runner hang. The Ubuntu job was rerun independently on the same release commit and passed syntax, full repository tests, and real-browser smoke.
- Host Identity / Environment Fingerprint v0.1 is **FROZEN** at `a7264db2b61c5cdc6ad33b04fc3a97c4fe47d24e`.
- The freeze decision records the runner anomaly and successful same-commit rerun; no product or workflow changes were required.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**GLOB-PATH-MATCHER-V0.1-SPEC**

### Immediate next task

Write and commit the complete SPEC for **Glob / Path Matcher v0.1** before implementation begins.

The SPEC must lock:

1. standalone cross-platform path-pattern matching API
2. explicit glob grammar and segment semantics
3. separator normalization and platform-independent matching rules
4. literal escaping and special-character handling
5. `*`, `?`, and recursive `**` semantics with bounded complexity
6. absolute/relative path behavior and root anchoring
7. case-sensitivity policy as an explicit option, never an implicit OS guess
8. path traversal and dot-segment safety semantics
9. deterministic include/exclude evaluation and ordered rule precedence
10. bounded pattern/path lengths and failure/recovery behavior
11. injectable filesystem/path capability seams only where needed; no filesystem access in the pure matcher core
12. Ubuntu, Windows, macOS-15-Intel, and relevant WSL verification
13. zero-runtime-third-party-dependency boundary

No implementation starts before the SPEC exists on the control plane.

## Scope lock

The next cube owns pure path-pattern compilation and matching plus an optional small rule-evaluation layer. It does not own filesystem traversal, directory snapshots, filesystem watching, archive extraction, shell glob expansion, shell command execution, or persistent storage.

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
