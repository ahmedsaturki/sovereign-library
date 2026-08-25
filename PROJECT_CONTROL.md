# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Filesystem Metadata / Stat Normalizer v0.1**.

## Current repository state

- Last released cube: **Filesystem Metadata / Stat Normalizer v0.1**
- Release PR: **#93**, squash-merged
- Release commit: `44f1acc2f277a2016013146423bd97a7a4e15057`
- Pre-merge verification: **Run 681**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, 641 full-suite tests, and real-browser smoke.
- Post-merge verification: **Run 682**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Filesystem Metadata / Stat Normalizer v0.1 is **FROZEN** at `44f1acc2f277a2016013146423bd97a7a4e15057`.
- Blocking fix discovered in Run 680: native Linux `birthtimeMs`/timestamp fields can contain valid fractional milliseconds; the implementation was corrected to truncate finite non-negative timestamps within the safe numeric range.
- Additional hardening includes privacy-safe coarse platform normalization, Safe Path Resolver-backed containment for relative symlink targets, safe numeric bounds, accessor-safe capabilities/options, deterministic FMN1 SHA-256 serialization, and recovery policies.
- No runtime third-party dependencies were added.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**BOUNDED-FILE-CONTENT-READER-V0.1-SPEC**

### Immediate next task

Write and commit the complete SPEC for **Bounded File Content Reader / Safe Content Access v0.1** before implementation begins.

The SPEC must lock:

1. standalone cross-platform bounded byte/text reading API
2. explicit binary versus UTF-8 text semantics with no implicit encoding guessing
3. root/path anchoring through the released Safe Path Resolver boundary
4. maximum bytes, maximum lines/chunks, and total work/time budgets
5. streaming, chunked, and fully-collected modes with bounded memory behavior
6. exact offset/length semantics, partial read policy, and EOF behavior
7. symlink non-following default and explicit contained-follow policy
8. BOM policy, newline normalization policy, and decoder error policy
9. capability seams for file open/read/stat/close without executable objects entering data validation
10. cancellation, deadline, backpressure, and cleanup semantics
11. changing-file and truncation race handling
12. immutable results and deterministic metadata
13. privacy-safe diagnostics that never copy arbitrary file contents into errors
14. Ubuntu, Windows, macOS-15-Intel, and relevant WSL verification
15. zero-runtime-third-party-dependency boundary

No implementation starts before the SPEC exists on the control plane.

## Scope lock

The next cube owns safe, bounded file-content access and decoding. It does not own directory traversal, filesystem watching, glob matching, metadata normalization, snapshots/manifests, persistence, archive extraction, shell execution, or content indexing/search.

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
