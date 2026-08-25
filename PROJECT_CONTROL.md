# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Release Approval / Decision Record Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Release Approval / Decision Record v0.1**
- Release PR: **#74**, squash-merged
- Release commit: `8f05e628d326c23c3d877742c2f2b7bd05c22aa9`
- Pre-merge verification: **Run 549**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 550**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Release Approval / Decision Record v0.1 is therefore **FROZEN**.
- The release provides deterministic required/optional approval scopes, conflict detection, approve/reject/pending status evaluation, bounded immutable decision evidence, SAD1 checksum-protected serialization, typed fail-closed errors, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-RELEASE-CLOSURE-RECEIPT-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic release closure receipt:

1. accept one explicit frozen release snapshot identity plus one explicit approved decision record
2. validate exact snapshot/approval linkage and status compatibility
3. normalize closure metadata and evidence references deterministically
4. reject mismatched snapshot ids/checksums, non-approved decisions, duplicate receipt ids, and invalid closure metadata
5. produce a bounded immutable closure receipt suitable for later publication systems to consume
6. serialize and parse the receipt with deterministic checksum/integrity protection
7. never publish, mutate artifacts, or call external services
8. no network, filesystem discovery, registry lookup, scheduler, signing, or publication side effects
9. zero runtime third-party dependencies
10. unit, contract, failure, recovery, and cross-platform verification
11. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Release Closure Receipt v0.1, allowed scope is only:

- explicit frozen snapshot identity
- explicit approved decision record identity
- deterministic linkage validation
- immutable bounded closure metadata and evidence
- typed fail-closed errors
- deterministic checksum-protected receipt serialization
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- publication/deployment
- external release services
- network/filesystem/registry discovery
- signing/trust-chain verification
- automatic mutation or repair
- scheduling/orchestration
- GUI/admin console
- billing or cost accounting

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
