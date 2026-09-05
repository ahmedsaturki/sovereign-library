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
- [ ] `getScript()` returns immutable (deeply-frozen) snapshots; callers cannot
      mutate internal recorder state through the returned value.
- [ ] Redaction is opt-in, caller-controlled, record-time only, and fail-closed
      (`REDACT_ERROR` on redactor throw; no partial/unredacted fallback persisted).

## Security & integrity contracts (v0.1)

- **Immutability**: `getScript()` deep-clones and deep-freezes every step,
  target, and nested `params` object. Internal recorded state is owned solely by
  the recorder; caller mutation of returned snapshots has no effect on internal
  state (strict or sloppy mode).
- **No caller aliasing**: ingest input (`fill` value options, locator targets)
  is deep-cloned on record, so later caller mutation cannot change recorded data.
- **Redaction**: default preserves values verbatim; a configured `(params, step)
  => params` redactor masks sensitive data at record time; the recorder does NOT
  auto-detect secrets. A throwing redactor fails closed with `REDACT_ERROR` and
  the step is not persisted. Replay does not re-invoke the redactor.
