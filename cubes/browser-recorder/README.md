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
  each recorded step's params, so sensitive data (e.g. `fill` values on
  password/token fields) can be masked before persistence. Default: identity
  (no redaction).
- Deterministic error taxonomy with stable `code`.

## Example

```js
import { BrowserRecorder } from '@sovereign/browser-recorder';

const rec = new BrowserRecorder(page);
await rec.click(By.role('button', { name: 'Submit' }));
await rec.fill(By.css('#email'), 'user@example.com');
const script = rec.getScript();   // serializable
await rec.replay(anotherPage);    // reproduce elsewhere
```

## Error codes

| Code | Meaning |
|------|---------|
| `INVALID_PAGE` | recorder needs a page with `locator()` |
| `INVALID_REPLAY_TARGET` | replay target missing `locator()` |
| `UNKNOWN_STEP` | unrecognized step kind during replay |

## Status

**v0.1 — implemented, unit-tested, CI-pending.**
