# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Browser Cube v0.1** and release it before starting another cube.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**BROWSER-V0.1-RELEASE**

### Immediate next task

Complete the Browser Cube release gate:

1. run the repository test suite
2. run platform smoke checks where available
3. verify clean install/run instructions
4. verify release artifact contents
5. fix only failures required for the v0.1 gate
6. mark the release gate complete

## Scope lock

For Browser Cube v0.1, the allowed scope is only:

- Chromium-family browser launch
- CDP connection
- session lifecycle
- navigation
- JavaScript evaluation
- metadata
- screenshot
- deterministic errors
- cleanup
- documentation
- tests

Explicitly out of scope for v0.1:

- selector engine
- click/type/input APIs
- downloads/uploads
- advanced network interception
- stealth/anti-bot evasion
- CAPTCHA solving
- credential extraction
- account takeover or unauthorized automation
- multi-browser orchestration
- workflow engine
- HTTP server
- MCP server
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

## Decision rule

When uncertain, choose the smallest implementation that satisfies the current contract and can later be replaced without breaking consumers.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart the project from memory.

## Release sequence

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

No step may be skipped by calling the project complete early.
