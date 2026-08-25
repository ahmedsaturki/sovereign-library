# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **HTTP Headers / Cookies / Content Negotiation Cube v0.1** and release it before starting another cube.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**HTTP-METADATA-V0.1-RELEASE**

### Immediate next task

Build and release the native HTTP metadata cube:

1. freeze normalized header storage and multi-value semantics
2. implement safe header validation and deterministic normalization
3. implement Cookie parsing and Set-Cookie building
4. implement Accept / Accept-Encoding / Accept-Language negotiation
5. implement Content-Type / Content-Length helpers
6. implement ETag and conditional request helpers
7. add immutable metadata snapshots
8. add malformed-value and security-boundary coverage
9. verify zero runtime third-party dependencies
10. run the supported cross-platform CI matrix
11. fix only failures required for the v0.1 gate
12. squash-merge the release PR
13. update ROADMAP before starting another cube

## Scope lock

For HTTP Headers / Cookies / Content Negotiation Cube v0.1, the allowed scope is only:

- case-insensitive header storage and deterministic normalization
- multi-value header semantics where applicable
- safe request/response header validation
- Cookie header parsing
- Set-Cookie builder with bounded attributes
- Accept / Accept-Encoding / Accept-Language negotiation helpers
- Content-Type / Content-Length parsing helpers
- ETag / conditional request helpers
- immutable metadata snapshots
- deterministic malformed-value errors
- documentation
- local unit/integration/failure/recovery tests

Explicitly out of scope for v0.1:

- cookie jar persistence
- authentication/session framework
- compression implementation
- HTTP cache storage engine
- proxy behavior
- browser cookie policy emulation
- third-party header utility libraries
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
