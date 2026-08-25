# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Directory Snapshot / Tree Manifest v0.1**.

## Current repository state

- Last released cube: **Directory Snapshot / Tree Manifest v0.1**
- Release PR: **#85**, squash-merged
- Release commit: `c01cc08e97404d1528fb93d6728fd2ae272871c3`
- Pre-merge verification: **Run 633**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 635**, passed on `main` across Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Directory Snapshot / Tree Manifest v0.1 is **FROZEN** at `c01cc08e97404d1528fb93d6728fd2ae272871c3`.
- During the release cycle, the cube was hardened against capability/data boundary confusion, manifest-size test fixture error, Windows namespace paths, macOS canonical-root aliases, and contained symlink cycles. The final release keeps the read-only public contract unchanged.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**HOST-IDENTITY-FINGERPRINT-V0.1-SPEC**

### Immediate next task

Write and commit the complete SPEC for **Host Identity / Environment Fingerprint v0.1** before implementation begins.

The SPEC must lock:

1. standalone local host/environment fingerprint API
2. explicit stable vs volatile identity fields
3. privacy-preserving default field set with no secrets or credentials
4. deterministic normalization and canonical serialization
5. explicit platform coverage and missing-capability behavior
6. bounded output size and field cardinality
7. injectable identity, clock, filesystem, and environment capability seams
8. reproducibility rules and comparison semantics
9. fail-closed handling of malformed/accessor/circular inputs
10. Ubuntu, Windows, macOS-15-Intel, and relevant WSL verification
11. zero-runtime-third-party-dependency boundary

No implementation starts before the SPEC exists on the control plane.

## Scope lock

The next cube owns local environment fingerprint construction and comparison-safe identity data. It does not own secret discovery, credential extraction, network inventory, remote host discovery, process supervision, runtime capability probing, or persistent storage.

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
