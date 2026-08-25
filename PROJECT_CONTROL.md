# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Search / Index Cube v0.1** and release it before starting another cube.

## Current repository state

- Last released cube: **CLI / Command Runtime v0.1**
- Release path: **direct-main gated release**
- Release commit: `61eac767bca438e63d28a28892ffcc0dab956e36`
- Release verification: **Run 366**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- CLI / Command Runtime v0.1 is therefore **FROZEN**.
- `ROADMAP.md` and `README.md` were updated to record the release and activate Search / Index.
- Earlier CLI CI failures were resolved with minimal source fixes and regression coverage: optional defaults, child-command normalization, explicit-option tracking, parser fail-closed handling, and accessor-safe configuration validation.
- Duplicate Redaction PR #47 remains closed as superseded by PR #45.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**SEARCH-INDEX-V0.1-SPEC**

### Immediate next task

Freeze the public contract for a standalone native Search / Index product:

1. define the indexed document and identifier contract
2. define deterministic Unicode-safe tokenization and normalization semantics
3. define an owned inverted-index representation
4. define add, update, remove, and rebuild lifecycle behavior
5. define exact-term, AND/OR, prefix, and bounded phrase-query semantics
6. define deterministic scoring and result ordering
7. define bounds for documents, fields, tokens, query size, postings, and results
8. define immutable snapshots and source immutability
9. define typed fail-closed errors without copying arbitrary payloads
10. define recovery behavior after rejected mutations and failed rebuilds
11. verify zero runtime third-party dependencies
12. define unit, contract, integration, failure, and recovery gates
13. write the standalone cube specification before implementation

## Scope lock

For Search / Index Cube v0.1, the allowed scope is only:

- local in-memory inverted indexing
- deterministic text tokenization and normalization
- document add/update/remove/rebuild
- exact-term query
- AND/OR term query
- bounded prefix query
- bounded phrase query
- deterministic relevance scoring
- deterministic tie-breaking
- bounded index memory/work
- immutable query results and index snapshots
- source immutability
- typed fail-closed diagnostics
- local unit/contract/integration/failure/recovery tests
- cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- network search services
- distributed indexes
- filesystem persistence
- vector/semantic embeddings
- fuzzy matching/edit distance
- external search engines
- third-party search/index packages
- web crawling
- ranking learned from external models

## Definition of done

A milestone is DONE only when:

- implementation exists
- public API is documented
- normal-path tests pass
- failure-path tests pass
- cleanup/restart behavior is verified where applicable
- supported-platform checks pass or documented capability limits exist
- example usage works
- release artifact is reproducible
- no known blocking defect remains
- `ROADMAP.md` is updated
- `PROJECT_CONTROL.md` points to the next active milestone

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
