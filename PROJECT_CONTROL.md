# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Finish the **Policy / Capability Security Cube v0.1** before starting another cube.

## Current repository state

- Last released cube: **Agent Runtime v0.1**
- Release PR: **#55**, squash-merged
- Release commit: `8d4608e012176a55bdc1822d3aea65add7aa7669`
- Pre-merge verification: **Run 409**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 410**, push on `main` for the release commit, completed with **success**.
- Agent Runtime v0.1 is therefore **FROZEN**.
- The release provides deterministic agent/session state, bounded context and tool work, capability allowlisting, immutable snapshots, cancellation/timeout/retry semantics, typed fail-closed diagnostics, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**POLICY-CAPABILITY-SECURITY-V0.1-SPEC**

### Immediate next task

Freeze and implement the public contract for a standalone capability-policy engine:

1. immutable policy definitions and deterministic normalization
2. explicit allow/deny capability records
3. hierarchical resource/action matching
4. deterministic precedence and conflict resolution
5. contextual decision inputs without hidden ambient authority
6. bounded policy size, rule count, path/resource length, and diagnostics
7. fail-closed evaluation on malformed rules and unsupported values
8. auditable immutable decision records with safe diagnostics
9. policy composition and versioned snapshots without cross-cube dependencies
10. no network, identity provider, or external authorization SDK requirement
11. zero runtime third-party dependencies
12. unit, contract, failure, recovery, and cross-platform verification
13. standalone SPEC, README, and runnable example before release

## Scope lock

For Policy / Capability Security Cube v0.1, allowed scope is only:

- local deterministic policy evaluation
- immutable policy snapshots
- capability/resource/action matching
- allow/deny precedence
- bounded contextual inputs
- fail-closed errors and safe decision diagnostics
- immutable audit decision records
- local composition/versioning of policy snapshots
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- network authorization services
- OAuth/OIDC providers
- remote policy control planes
- identity lifecycle management
- distributed consensus
- multi-agent orchestration
- GUI/admin console
- browser automation

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
