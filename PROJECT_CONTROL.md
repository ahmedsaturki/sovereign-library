# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **MIME / Multipart Cube v0.1** and release it before starting another cube.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**MIME-MULTIPART-V0.1-RELEASE**

### Immediate next task

Build and release the native MIME / Multipart Cube:

1. freeze MIME and multipart contracts
2. implement safe MIME/content-disposition parsing
3. implement bounded streaming multipart parsing
4. enforce total and per-part limits
5. extract text fields and binary file parts deterministically
6. implement immutable part metadata snapshots
7. implement multipart body building
8. integrate AbortSignal/cancellation and cleanup
9. add malformed-input and recovery coverage
10. verify zero runtime third-party dependencies
11. run the supported cross-platform CI matrix
12. fix only failures required for the v0.1 gate
13. squash-merge the release PR
14. update ROADMAP before starting another cube

## Scope lock

For MIME / Multipart Cube v0.1, the allowed scope is only:

- MIME type parsing and normalization
- multipart boundary validation
- streaming-safe multipart parsing
- bounded total and per-part sizes
- text field extraction
- binary file-part extraction
- content-disposition parsing
- header normalization and limits
- deterministic malformed-input errors
- multipart body builder
- immutable metadata snapshots
- cleanup/cancellation during streaming parse
- documentation
- local unit/integration/failure/recovery tests

Explicitly out of scope for v0.1:

- multipart compression
- resumable uploads
- remote object storage
- antivirus scanning
- image/video transcoding
- distributed upload coordination
- third-party multipart parsers
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
