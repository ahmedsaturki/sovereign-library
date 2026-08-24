# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Configuration / Environment Cube v0.1** and release it before starting another cube.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**CONFIGURATION-ENVIRONMENT-V0.1-RELEASE**

### Immediate next task

Complete the Configuration / Environment Cube release gate:

1. write and freeze the configuration contract
2. run syntax, unit, contract, integration, failure, and recovery tests
3. verify precedence, defaults, required/optional values, namespaces, and strict coercion
4. verify immutable snapshots and bounded input sizes
5. verify deterministic parsing and typed errors
6. verify secret redaction helpers for diagnostics/logging
7. verify testable source abstraction for environment/config inputs
8. verify zero runtime third-party dependencies
9. run the supported cross-platform CI matrix
10. fix only failures required for the v0.1 gate
11. mark the release gate complete

## Scope lock

For Configuration / Environment Cube v0.1, the allowed scope is only:

- typed configuration contract
- environment variable access
- immutable configuration snapshots
- explicit defaults
- required/optional values
- strict type coercion and validation
- deterministic precedence rules
- namespaced keys
- secret redaction helpers
- bounded input sizes
- deterministic parsing and typed errors
- testable configuration source abstraction
- documentation
- tests

Explicitly out of scope for v0.1:

- remote configuration services
- secret-management SaaS
- encrypted secret vaults
- configuration UI
- hot reload/watchers
- schema compiler frameworks
- third-party configuration packages
- AI agent runtime

## Definition of done

A milestone is DONE only when:

- implementation exists
- public API is documented
- normal-path tests pass
- failure-path tests pass
- cleanup/restart behavior is verified
- supported-platform checks pass or documented capability limits exist
- example usage works
- release artifact is reproducible
- no known blocking defect remains
- ROADMAP is updated

## Anti-loop rules

- Do not redesign the whole architecture during a cube release.
- Do not add a new dependency to solve a local problem without recording the decision.
- Do not start a second cube because the current cube is difficult.
- Do not expand scope because a competitor has more features.
- Do not call a cube production-ready from source inspection alone.
- If a problem is outside the active scope, park it and continue.

## Lessons-learned rule

Every blocking bug or CI failure must produce all of the following before release:

- root-cause identification
- minimal fix
- regression test
- CI protection when applicable
- documentation or control update when the lesson affects future work

## Clean-repository rule

`main` is the product branch. Temporary verification branches and PRs must not become runtime artifacts. Release merges should prefer a clean, single-purpose history. No marker files, generated dependency trees, vendor directories, or unused compatibility layers belong in the product.

## Decision rule

When uncertain, choose the smallest implementation that satisfies the current contract and can later be replaced without breaking consumers.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart the project from memory.

## Release sequence

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

No step may be skipped by calling the project complete early.
