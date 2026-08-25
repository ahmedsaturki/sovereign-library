# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Release Publication Confirmation / Outcome Receipt Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Release Publication Executor / Boundary v0.1**
- Release PR: **#76**, squash-merged
- Release commit: `23cf7b06e9162201683eb613d6c71c241cb5e34e`
- Pre-merge verification: **Run 561**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke. The only failure in the first attempt was a regression-test fixture that did not reach the accessor guard; the fixture was corrected and Run 561 passed fully.
- Post-merge verification: **Run 562**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Release Publication Executor / Boundary v0.1 is therefore **FROZEN**.
- The release provides deterministic preflight planning, explicit destination capability allowlists, bounded immutable plans/outcomes, idempotent execution semantics, explicit side-effect boundaries, SPE1 checksum-protected serialization, typed fail-closed errors, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-RELEASE-PUBLICATION-CONFIRMATION-OUTCOME-RECEIPT-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic publication confirmation receipt:

1. accept one explicit executed publication outcome snapshot and its originating closure receipt identity
2. validate that every successful/skipped outcome belongs to the exact planned intents and destination ids
3. preserve destination id, intent id, idempotency key, artifact identity/digest, and execution state
4. normalize bounded commit evidence and timestamps supplied by the caller without inventing them
5. reject outcome/plan mismatches, duplicate confirmation records, invalid states, accessors, circular values, and oversized evidence
6. produce an immutable confirmation receipt suitable for downstream audit/reconciliation cubes
7. serialize and parse the confirmation receipt with deterministic checksum/integrity protection
8. never execute side effects, mutate publication state, discover external systems, or acquire credentials
9. no network/filesystem/registry discovery, scheduler, signing, or retry ownership
10. zero runtime third-party dependencies in the core cube
11. unit, contract, failure, recovery, idempotency, and cross-platform verification
12. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Release Publication Confirmation / Outcome Receipt v0.1, allowed scope is only:

- explicit publication outcome snapshot input
- explicit originating closure receipt identity
- deterministic outcome/intent linkage validation
- bounded immutable confirmation records
- bounded commit evidence and caller-supplied timestamps
- typed fail-closed errors
- deterministic checksum-protected receipt serialization
- unit, contract, failure, recovery, idempotency, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- executing publication side effects
- external audit/reconciliation service calls
- destination discovery
- signing/trust-chain generation or verification
- scheduler/orchestration
- automatic retries
- credential management
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
