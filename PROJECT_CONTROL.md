# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

## Current mission

Build the **Artifact Provenance / Lineage Ledger Cube v0.1** as the next standalone Sovereign product.

## Current repository state

- Last released cube: **Artifact Reference Resolver / Locator v0.1**
- Release PR: **#66**, squash-merged
- Release commit: `7cb477e1e11ea5c5f9b145cf6eba1527482a4b57`
- Pre-merge verification: **Run 485**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 486**, push on `main` for the release commit, completed successfully on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Artifact Reference Resolver / Locator v0.1 is therefore **FROZEN**.
- The release provides canonical reference parsing/normalization, deterministic bounded candidate resolution, exact and alias matching, explicit ambiguity/not-found outcomes, immutable snapshots, typed fail-closed errors, no hidden discovery, and zero runtime third-party dependencies.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**ARTIFACT-PROVENANCE-LINEAGE-LEDGER-V0.1-SPEC**

### Immediate next task

Implement the public contract for a standalone deterministic local artifact provenance / lineage ledger:

1. canonical provenance records with stable artifact/event identity
2. explicit parent/child and derived-from lineage relationships
3. deterministic append-only event ordering with bounded local storage
4. actor/action/source metadata with fail-closed validation
5. deterministic ancestry/descendant traversal with depth and result bounds
6. immutable snapshots and replay-safe reads
7. atomic append/recovery semantics without partial writes
8. deterministic serialization with checksum and corruption detection
9. no network, registry, filesystem discovery, or external SDK required
10. zero runtime third-party dependencies
11. unit, contract, failure, recovery, and cross-platform verification
12. standalone SPEC, README, changelog, and runnable example before release

## Scope lock

For Artifact Provenance / Lineage Ledger v0.1, allowed scope is only:

- local provenance records and stable artifact/event identity
- explicit lineage relationships
- deterministic append-only event ordering
- bounded ancestry/descendant traversal
- immutable snapshots and replay-safe reads
- typed fail-closed errors
- atomic append/recovery behavior
- deterministic serialization and corruption detection
- unit, contract, failure, recovery, and cross-platform tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- remote provenance stores
- network transport
- distributed consensus or locks
- signature/certificate infrastructure
- automatic filesystem/registry discovery
- cryptographic trust policy engines
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
