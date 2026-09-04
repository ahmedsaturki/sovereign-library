# Browser Interactions Cube

A standalone, dependency-free interaction layer for the Sovereign Browser Cube.

Zero third-party dependencies. Depends ONLY on the browser session's
`evaluate(expression, returnByValue)` contract — the same contract the frozen
`browser` cube already provides.

## Why this exists

Selenium/Playwright/Puppeteer are heavy, opinionated, and bundled with their own
drivers/browsers. Sovereign Browser Interactions gives you the ergonomics users
expect (locators, auto-wait, input simulation) on top of a minimal CDP session —
with deterministic errors, bounded polling, and no supply-chain surface.

## What v0.1 provides

- `By` locator strategies: `css`, `text`, `role`, `label`, `title`, `testId`.
- `Locator` with `waitFor` / `waitForVisible` (deadline-driven, bounded polling).
- `Locator` actions: `click`, `fill`, `press`, `focus`, `clear`, `getAttribute`.
- `Locator` queries: `count`, `isVisible`, `isEnabled`, `textContent`, `value`.
- `nth(index)` for indexed matches.
- Strict mode (fails when a locator matches more than one element).
- Deterministic error taxonomy with stable `code` + `retryable` flag.
- Fully unit-testable via a fake session (no browser required).

## Usage

```js
import { launch } from '@sovereign/browser-cube';
import { BrowserInteractions, By } from '@sovereign/browser-interactions';

const browser = await launch();
try {
  const page = new BrowserInteractions(browser);
  await page.locator(By.role('button', { name: 'Submit' })).waitForVisible();
  await page.locator(By.css('#email')).fill('user@example.com');
  await page.locator(By.css('button[type=submit]')).click();
  const title = await page.title();
} finally {
  await browser.close();
}
```

## Error codes

| Code | Meaning | Retryable |
|------|---------|-----------|
| `INVALID_SESSION` | session missing `evaluate()` | no |
| `INVALID_SELECTOR` | empty/invalid locator | no |
| `INVALID_OPTION` | bad option (timeout, key, index) | no |
| `STRICT_VIOLATION` | locator matched >1 element in strict mode | no |
| `PROBE_FAILED` | page probe returned nothing | yes |
| `WAIT_TIMEOUT` | element not found/visible in time | yes |
| `ELEMENT_NOT_FOUND` | no element for read | yes |
| `CLICK_FAILED`/`FILL_FAILED`/`PRESS_FAILED`/`FOCUS_FAILED`/`CLEAR_FAILED` | action target missing | yes |

## Non-goals (v0.1)

Shadow DOM piercing, iFrame traversal, visual/pixel diffing, network
interception, multi-tab orchestration — each is a separate, standalone cube.

## Status

**v0.1 — implemented, unit-tested, CI-pending.**
