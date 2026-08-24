# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **WebSocket / Transport Cube v0.1** and release it before starting another cube.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**WEBSOCKET-TRANSPORT-V0.1-RELEASE**

### Immediate next task

Complete the WebSocket / Transport Cube release gate:

1. run the repository test suite
2. run platform smoke checks on Ubuntu, Windows, and macOS
3. verify native client/server handshake and lifecycle behavior
4. verify cleanup, timeout, masking, fragmentation, close, and payload-limit behavior
5. verify zero runtime third-party dependencies
6. fix only failures required for the v0.1 gate
7. mark the release gate complete

## Scope lock

For WebSocket / Transport Cube v0.1, the allowed scope is only:

- RFC 6455 framing
- masking/unmasking validation
- HTTP upgrade handshake
- native client/server transport
- text/binary messages
- fragmentation assembly
- ping/pong
- close handshake
- payload limits
- deterministic protocol errors
- lifecycle timeout/cleanup
- documentation
- tests

Explicitly out of scope for v0.1:

- Socket.IO
- third-party WebSocket packages
- compression/extensions
- broker/pubsub
- distributed state
- authentication framework
- reconnection orchestration
- workflow engine
- AI agent runtime

Those become future cubes or future releases only after v0.1 is released.

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
