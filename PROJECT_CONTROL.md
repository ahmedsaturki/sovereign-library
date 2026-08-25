# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Select and specify the next standalone Sovereign product after freezing **Safe Path Resolver / Containment Boundary v0.1**.

## Current repository state

- Last released cube: **Safe Path Resolver / Containment Boundary v0.1**
- Release PR: **#90**, squash-merged
- Release commit: `0216f3acd81331c031ac0ae023bfc1322f9064bc`
- Exact-SHA external verification: **PASS** at `b52473ee8f4148932ec3d8526bbfe3ef5abac14c` with 400+ repository tests, 14/14 cube tests, and browser smoke 1/1.
- Pre-merge verification: **Run 664**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 665**, attempt 2 passed on Ubuntu, Windows, and macOS-15-Intel; the original macOS attempt had a transient runner hang and the fresh same-commit rerun passed all gates.
- Safe Path Resolver / Containment Boundary v0.1 is **FROZEN** at `0216f3acd81331c031ac0ae023bfc1322f9064bc`.
- No product-code or workflow changes were required to resolve the post-merge runner anomaly.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**DIRECTORY-WALKER-BOUNDED-TREE-TRAVERSAL-V0.1-SPEC**

### Immediate next task

Write and commit the complete SPEC for **Directory Walker / Bounded Tree Traversal v0.1** before implementation begins.

The SPEC must lock:

1. standalone cross-platform directory traversal API
2. root anchoring and safe-path integration without shell expansion
3. lexical versus filesystem-aware traversal semantics
4. deterministic traversal order independent of host filesystem enumeration
5. file, directory, symlink, and special-entry policies
6. bounded depth, entry count, path length, and total traversal budget
7. cancellation, timeout, and backpressure semantics
8. visitor versus collected-result modes without accidental unbounded memory growth
9. capability seams for filesystem metadata and directory reads without leaking executable objects into data validation
10. failure/recovery behavior including partial traversal policy
11. non-mutating guarantees
12. Ubuntu, Windows, macOS-15-Intel, and relevant WSL verification
13. zero-runtime-third-party-dependency boundary

No implementation starts before the SPEC exists on the control plane.

## Scope lock

The next cube owns bounded directory traversal and deterministic tree walking. It does not own snapshot serialization/digesting, filesystem watching, glob matching, safe path resolution policy, archive extraction, shell expansion, shell execution, or persistent storage.

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
