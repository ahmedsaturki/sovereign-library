# Browser Assertions Cube

A standalone, dependency-free assertion + snapshot layer for
`browser-interactions`. Zero third-party dependencies.

## What v0.1 provides

- `expect(locator)` with auto-retrying assertions:
  - `toBeVisible` / `toBeHidden`
  - `toBeEnabled` / `toBeDisabled`
  - `toHaveText` / `toHaveValue` / `toHaveAttribute` / `toHaveCount`
- Bounded, deadline-driven retries (every assertion is retryable by default).
- `Snapshot.capture(html)` / `Snapshot.diff(before, after)` — canonical,
  key-stable structural comparison.
- Deterministic error taxonomy with stable `code` + `retryable` flag.

## Usage

```js
import { BrowserInteractions, By } from '@sovereign/browser-interactions';
import { expect, Snapshot } from '@sovereign/browser-assertions';

const page = new BrowserInteractions(session);
const submit = page.locator(By.role('button', { name: 'Submit' }));

await expect(submit).toBeVisible();
await expect(submit).toHaveText('Submit');
await expect(page.css('#email')).toHaveValue('user@example.com');

const snap = new Snapshot();
const before = snap.capture(await page.content());
// ...mutate UI...
const after = snap.capture(await page.content());
assert.equal(snap.diff(before, after).equal, true);
```

## Error codes

| Code | Meaning | Retryable |
|------|---------|-----------|
| `NOT_VISIBLE` | expected visible | yes |
| `NOT_HIDDEN` | expected hidden | no |
| `NOT_ENABLED` | expected enabled | yes |
| `NOT_DISABLED` | expected disabled | no |
| `TEXT_MISMATCH` | text differs | yes |
| `VALUE_MISMATCH` | value differs | yes |
| `ATTRIBUTE_MISMATCH` | attribute differs | yes |
| `COUNT_MISMATCH` | element count differs | yes |
| `INVALID_OPTION` | bad option | no |
| `INVALID_SNAPSHOT` | non-string snapshot source | no |

## Status

**v0.1 — implemented, unit-tested, CI-pending.**
