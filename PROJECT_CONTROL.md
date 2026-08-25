# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Directory Walker / Bounded Tree Traversal v0.1**.

## Current repository state

- Last released cube: **Directory Walker / Bounded Tree Traversal v0.1**
- Release PR: **#92**, squash-merged
- Release commit: `4d64f6610286524799ebe809021279a7b7be3d40`
- Pre-merge verification: **Run 674**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 675**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Directory Walker / Bounded Tree Traversal v0.1 is **FROZEN** at `4d64f6610286524799ebe809021279a7b7be3d40`.
- Blocking fixes included deterministic frame-based traversal, accessor-safe option handling, explicit symlink rejection, canonical-root containment, and bounded symlink depth.
- No runtime third-party dependencies were added.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**FILESYSTEM-METADATA-STAT-NORMALIZER-V0.1-SPEC**

### Immediate next task

Write and commit the complete SPEC for **Filesystem Metadata / Stat Normalizer v0.1** before implementation begins.

The SPEC must lock:

1. standalone cross-platform metadata normalization API
2. normalized file/directory/symlink/special kind semantics
3. stable numeric/stat field normalization across POSIX and Windows
4. timestamp, size, mode, identity, and platform-specific field policies
5. explicit capability seam for `lstat`/`stat` without executable objects entering data validation
6. symlink non-following default and explicit target-resolution policy
7. bounded metadata object size, path/name limits, and integer-safe fields
8. deterministic serialization/canonical representation
9. privacy policy for host/user/device metadata (must not leak environment information)
10. failure/recovery semantics for missing, permission-denied, malformed, and changing entries
11. non-mutating guarantees
12. Ubuntu, Windows, macOS-15-Intel, and relevant WSL verification
13. zero-runtime-third-party-dependency boundary

No implementation starts before the SPEC exists on the control plane.

## Scope lock

The next cube owns metadata/stat normalization and its immutable canonical representation. It does not own directory traversal, snapshot/digest manifests, filesystem watching, glob matching, path containment policy, persistence, or content indexing.

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
