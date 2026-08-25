# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Compliance / Policy Evaluator Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Audit / Drift Reporter v0.1**
- Release PR: **#69**, squash-merged
- Release commit: `f939f13437412682600aad691998cae9d5218606`
- Pre-merge verification: **Run 511**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 512**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Audit / Drift Reporter v0.1 is therefore **FROZEN**.
- The release provides deterministic baseline/current artifact comparison, unchanged/changed/added/removed classification, digest/version/lifecycle/lineage drift detection, bounded immutable findings, typed fail-closed errors, checksum-protected serialization, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-COMPLIANCE-POLICY-EVALUATOR-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic artifact compliance/policy evaluator:

1. accept only explicit artifact records and explicit policy rules supplied by the caller
2. normalize policy rules into a stable deterministic form
3. evaluate identity, digest, version, lifecycle, lineage, metadata, and bounded numeric/string constraints
4. classify each violation by stable rule id, severity, and category
5. support deny/allow style predicates without an external policy engine
6. produce bounded immutable compliance reports with deterministic ordering
7. fail closed on malformed, accessor, circular, duplicate-rule, invalid-regex, and oversized inputs
8. provide deterministic report serialization with checksum/integrity protection
9. no network, filesystem discovery, registry lookup, or automatic repair
10. zero runtime third-party dependencies
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Compliance / Policy Evaluator v0.1, allowed scope is only:

- explicit local artifact data
- explicit local compliance rules
- deterministic normalization and evaluation
- bounded immutable compliance findings and reports
- typed fail-closed errors
- deterministic checksum-protected report serialization
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- remote policy retrieval
- network/filesystem/registry discovery
- automatic repair or mutation of source artifacts
- distributed policy evaluation
- signature/trust-chain verification
- GUI/admin console
- background scheduler integration
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
