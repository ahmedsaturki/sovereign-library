# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Release Snapshot / Candidate Set Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Release Plan / Deterministic Publication Plan v0.1**
- Release PR: **#72**, squash-merged
- Release commit: `80c1dcc1a653da8247fdabc0849ecf7d9139259c`
- Pre-merge verification: **Run 536**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 537**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Release Plan / Deterministic Publication Plan v0.1 is therefore **FROZEN**.
- The release provides deterministic dependency-first ordering, explicit admission enforcement, bounded immutable dry-run steps, compact evidence references, typed fail-closed errors, SRP1 checksum-protected serialization, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-RELEASE-SNAPSHOT-CANDIDATE-SET-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic release candidate snapshot:

1. accept only explicit artifact candidate records supplied by the caller
2. normalize candidate identity, version, digest, admission verdict, and evidence references into a stable form
3. reject duplicates, malformed/accessor/circular/oversized inputs, invalid identities, and inconsistent candidate fields
4. produce a deterministic candidate ordering independent of input insertion order
5. compute a bounded immutable snapshot with exact candidate counts and stable identity records
6. prevent duplicate artifact identities or conflicting versions/digests from entering one snapshot
7. serialize and parse the snapshot with deterministic checksum/integrity protection
8. never mutate artifacts and never discover candidates externally
9. no network, filesystem discovery, registry lookup, scheduler, or publication
10. zero runtime third-party dependencies
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Release Snapshot / Candidate Set v0.1, allowed scope is only:

- explicit local candidate artifact data
- deterministic identity/version/digest normalization
- immutable candidate snapshots
- bounded evidence references
- typed fail-closed errors
- deterministic checksum-protected snapshot serialization
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- external candidate discovery
- network/filesystem/registry scanning
- publication/deployment
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
