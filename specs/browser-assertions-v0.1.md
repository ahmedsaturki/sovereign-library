# Browser Assertions Cube v0.1

## Purpose

Assertion + snapshot layer for browser interactions, built on top of
`browser-interactions` and `canonical-json`. Provides Playwright/Cypress-style
expectations that are deterministic, serializable, and retryable.

## Scope (v0.1)

- `expect(locator)` with: `toBeVisible`, `toBeHidden`, `toBeEnabled`,
  `toBeDisabled`, `toHaveText`, `toHaveValue`, `toHaveAttribute`,
  `toHaveCount`.
- Auto-retrying assertions (bounded deadline, like Playwright `expect`).
- Soft assertions (collect failures, report at end).
- DOM/HTML snapshot capture + stable snapshot (canonical-json normalized).
- Deterministic error taxonomy with stable codes + retryable flag.

## Non-goals (v0.1)

- Visual/pixel snapshot diffing (separate cube).
- Custom matcher plugins (future).

## Definition of done

- [ ] `node --check src/index.js` clean.
- [ ] Unit tests pass with a fake `BrowserInteractions` session.
- [ ] Errors carry `code` + `retryable`.
- [ ] Zero runtime third-party dependencies.
- [ ] Cross-platform (no platform-specific code).
