# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **HTTP Server / Router Cube v0.1** and release it before starting another cube.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**HTTP-SERVER-ROUTER-V0.1-RELEASE**

### Immediate next task

Build and release the native HTTP Server / Router Cube:

1. freeze the server/router contract
2. implement native HTTP/HTTPS server creation
3. implement deterministic method/path routing and params
4. implement query parsing and bounded request bodies
5. implement response helpers and headers/status
6. implement ordered async middleware
7. implement centralized error and 404/405 handling
8. integrate request lifecycle cancellation where supported
9. implement graceful close and connection cleanup
10. add unit, contract, integration, failure, and recovery tests
11. verify zero runtime third-party dependencies
12. run cross-platform CI and real HTTP integration coverage
13. fix only failures required for the v0.1 gate
14. squash-merge the release PR
15. update ROADMAP before starting another cube

## Scope lock

For HTTP Server / Router Cube v0.1, the allowed scope is only:

- native HTTP/HTTPS server creation
- method/path routing
- path parameters
- query parsing
- request body limits
- JSON/text response helpers
- status/header management
- ordered middleware
- async handlers
- centralized error handling
- 404 and method-not-allowed behavior
- request lifecycle propagation where supported
- graceful close and connection cleanup
- immutable route/response metadata snapshots
- documentation
- local unit/integration/failure/recovery tests

Explicitly out of scope for v0.1:

- WebSocket upgrade handling
- multipart parser
- sessions/cookies framework
- authentication/authorization framework
- compression framework
- templating engine
- reverse proxy
- distributed server state
- third-party web frameworks
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
