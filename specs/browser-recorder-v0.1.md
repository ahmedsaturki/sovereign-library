# Browser Recorder Cube v0.1

## Purpose

Record a sequence of browser interactions into a replayable, serializable script.
This is the Sovereign answer to Playwright Codegen / Cypress recording — but zero
dependency, local-first, and emit-friendly to any agent or test harness.

## Scope (v0.1)

- Wrap a `BrowserInteractions` page and capture each action (click/fill/press/focus).
- Optional DOM snapshot before each step for replay/assertion.
- Emit a deterministic, human-readable script (array of steps).
- Replay the recorded steps against any compatible session.
- Strict capability injection: recorder is testable with a fake interactions layer.

## Non-goals (v0.1)

- Wildcard/AI auto-healing selectors (future).
- Video/screencast capture (separate cube).
- Network capture (separate cube).

## Definition of done

- [ ] `node --check src/index.js` clean.
- [ ] Unit tests pass with a fake interactions layer.
- [ ] Replay reproduces the recorded steps exactly.
- [ ] Zero runtime third-party dependencies.
- [ ] Cross-platform (no platform-specific code).
