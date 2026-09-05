# Browser Interactions Cube v0.1

## Purpose

A standalone, dependency-free interaction layer for the Sovereign Browser Cube.
It consumes only the `evaluate(expression, returnByValue)` contract of a browser
session and adds the high-value ergonomics that Playwright/Cypress/Selenium users
expect — without any third-party dependency and without modifying the frozen
Browser Cube.

## Design contract

The cube accepts a `session` object that satisfies exactly one method:

```
session.evaluate(expression: string, returnByValue?: boolean): Promise<any>
```

No CDP access, no process control, no filesystem. This keeps the cube
**standalone** and lets it be unit-tested with a pure in-memory fake.

## Scope (v0.1)

- `By` locator strategies: `css`, `text`, `role`, `label`, `title`, `testId`.
- `Locator` with deterministic, bounded waiting (`waitFor`, `waitForVisible`).
- `ElementHandle` with: `textContent`, `value`, `isVisible`, `isEnabled`,
  `click`, `fill`, `press`, `focus`, `getAttribute`, `count`.
- Auto-waiting before every action (actionability probe).
- Input simulation via real DOM events (focus, input, keydown/keyup, click).
- Strict-mode option (fail if more than one match).
- Deterministic error classification with stable codes and `retryable` flag.
- Bounded polling only (no unbounded sleeps, no fixed sleeps in the hot path).

## Non-goals (v0.1)

- Shadow DOM piercing across boundaries.
- iFrame traversal.
- Visual / pixel diffing.
- Network interception (separate cube).
- Multi-tab orchestration (separate cube).

## API surface

```js
import { By, Locator, BrowserInteractions, InteractionsError } from './src/index.js';

const page = new BrowserInteractions(session);
const submit = page.locator(By.role('button', { name: 'Submit' }));
await submit.waitForVisible({ timeoutMs: 5000 });
await submit.click();
```

## Definition of done

- [ ] `node --check src/index.js` clean.
- [ ] Unit tests pass with a fake session (no browser required).
- [ ] Smoke test passes when a real browser is present, skips otherwise.
- [ ] Errors carry `code` + `retryable`.
- [ ] Cross-platform (Windows/Linux/macOS/WSL) — no platform-specific code.
- [ ] Zero runtime third-party dependencies.
```
