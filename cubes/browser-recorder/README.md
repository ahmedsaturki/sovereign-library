# Browser Recorder Cube

A standalone, dependency-free interaction recorder + replay engine. The Sovereign
answer to Playwright Codegen / Cypress recording — local-first, emit-friendly, and
fully unit-testable.

## What v0.1 provides

- `BrowserRecorder(page)` wraps any interactions layer and records each action.
- Records `click` / `fill` / `press` as plain, JSON-safe step objects.
- Optional DOM snapshot per step (via injected `snapshot` function).
- `getScript()` returns the recorded steps; `replay(interactions)` reproduces them.
- Optional `redact` option: a `(params, step) => params` transform applied to
  each recorded step's params **at record time only**, so sensitive data (e.g.
  `fill` values on password/token fields) can be masked before persistence.
  - **Default: no redaction** — values are preserved verbatim.
  - **Caller-controlled masking**: the recorder does **not** automatically detect
    secrets. The configured redactor decides what to mask.
  - **Fail-closed**: if the redactor throws, the step is **not** persisted and a
    classified `RecorderError` with code `REDACT_ERROR` is thrown. Neither the
    partially-redacted nor the original unredacted value is written.
  - Replay never re-invokes the redactor (redaction is record-time only).
- `getScript()` returns **immutable snapshots**: every step, target, and nested
  params object is a fresh, deeply-frozen copy. Callers cannot mutate the
  recorder's internal state through the returned value (regardless of strict vs
  sloppy mode). Repeated calls return independent snapshots.
- The recorder never aliases caller-owned objects: ingest input is deep-cloned,
  so later mutation of the caller's options/fill values cannot change recorded
  data.
- Deterministic error taxonomy with stable `code`.

## Example

```js
import { BrowserRecorder } from '@sovereign/browser-recorder';

const rec = new BrowserRecorder(page, {
  // Opt-in redaction — YOU decide what is sensitive.
  redact(params, step) {
    const id = (step.target && step.target.value) || '';
    if (/password|token|apikey|secret/i.test(id) && params.value) {
      return { ...params, value: '<REDACTED>' };
    }
    return params;
  }
});
await rec.click(By.role('button', { name: 'Submit' }));
await rec.fill(By.css('#email'), 'user@example.com');
const script = rec.getScript();   // deeply-frozen, immutable snapshots
await rec.replay(anotherPage);    // reproduce elsewhere
```

## Error codes

| Code | Meaning |
|------|---------|
| `INVALID_PAGE` | recorder needs a page with `locator()` |
| `INVALID_REPLAY_TARGET` | replay target missing `locator()` |
| `UNKNOWN_STEP` | unrecognized step kind during replay |
| `REDACT_ERROR` | configured redactor threw; step not recorded (fail-closed) |

## Status

**v0.1 — implemented, unit-tested, CI-pending.**
