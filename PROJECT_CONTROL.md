# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Admission Gate / Release Eligibility Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Compliance / Policy Evaluator v0.1**
- Release PR: **#70**, squash-merged
- Release commit: `10ea69e80865fda16e385a635fa7bdde17162769`
- Pre-merge verification: **Run 524**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 525**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Compliance / Policy Evaluator v0.1 is therefore **FROZEN**.
- The release provides deterministic rule normalization, explicit artifact/rule evaluation, identity/digest/version/lifecycle/lineage/metadata/constraint predicates, bounded immutable findings, typed fail-closed errors, SCP1 checksum-protected serialization, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-ADMISSION-GATE-RELEASE-ELIGIBILITY-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic artifact admission/release eligibility gate:

1. accept explicit artifact records plus an explicit admission configuration only
2. evaluate required compliance verdicts, lifecycle state, digest presence, version validity, provenance/lineage status, and bounded metadata requirements
3. support deterministic required/optional gate clauses with stable ids
4. produce a single immutable eligibility verdict plus bounded blocking/non-blocking reasons
5. preserve evidence references without copying unbounded payloads
6. fail closed on malformed/accessor/circular/duplicate clause/invalid configuration/oversized inputs
7. serialize and parse the gate result deterministically with checksum/integrity protection
8. never mutate artifact inputs and never perform automatic repair
9. no network, filesystem discovery, registry lookup, or external policy engine required
10. zero runtime third-party dependencies
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Admission Gate / Release Eligibility v0.1, allowed scope is only:

- explicit local artifact data
- explicit gate configuration supplied by the caller
- deterministic eligibility evaluation
- immutable verdict/evidence summaries
- typed fail-closed errors
- deterministic checksum-protected result serialization
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- remote policy retrieval
- network/filesystem/registry discovery
- automatic repair, mutation, or publication
- release scheduling/orchestration
- signing or trust-chain verification
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
