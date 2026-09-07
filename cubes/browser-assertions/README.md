# Browser Assertions Cube

A standalone, dependency-free assertion + snapshot layer for
`browser-interactions`. Zero third-party dependencies. The package artifact is
**self-contained**: it carries its own key-stable canonicalization primitive — a
documented **subset** of the Sovereign `canonical-json` cube tailored to its
`{ html: string }` snapshot payload — so it installs independently without access
to the monorepo filesystem layout.

## What v0.1 provides

- `expect(locator)` with bounded, deadline-driven assertions:
  - `toBeVisible` / `toBeHidden`
  - `toBeEnabled` / `toBeDisabled`
  - `toHaveText` / `toHaveValue` / `toHaveAttribute` / `toHaveCount`
- **Retry semantics** (bounded deadline, respects each error's `retryable` flag):
  - Retried until the deadline: `NOT_VISIBLE`, `NOT_ENABLED`, `TEXT_MISMATCH`,
    `VALUE_MISMATCH`, `ATTRIBUTE_MISMATCH`, `COUNT_MISMATCH`.
  - Surfaced immediately (no polling): `NOT_HIDDEN`, `NOT_DISABLED`,
    `INVALID_OPTION`, `INVALID_TIMEOUT`, `INVALID_SNAPSHOT`.
  - Unexpected non-`AssertionsError` session/runtime errors propagate immediately
    and are **not** retried.
- **Soft assertions** (v0.1 minimal API, local to the instance):
  - `softErrors()` → frozen array (insertion order; empty when none).
  - `hasSoftErrors()` → boolean.
  - `clearSoftErrors()` → resets the collection.
  - State is per-`LocatorAssertions` instance; no hidden global collector.
- `Snapshot.capture(html)` / `Snapshot.diff(before, after)` — **Contract A: exact
  normalized HTML-string comparison** (NOT structural DOM normalization).

## Retry semantics

| Code | Meaning | Retryable |
|------|---------|-----------|
| `NOT_VISIBLE` | expected visible | yes |
| `NOT_ENABLED` | expected enabled | yes |
| `TEXT_MISMATCH` | text differs | yes |
| `VALUE_MISMATCH` | value differs | yes |
| `ATTRIBUTE_MISMATCH` | attribute differs | yes |
| `COUNT_MISMATCH` | element count differs | yes |
| `NOT_HIDDEN` | expected hidden but visible (hard state failure) | no |
| `NOT_DISABLED` | expected disabled but enabled (hard state failure) | no |
| `INVALID_OPTION` | bad attribute name / count / options (validated pre-evaluation) | no |
| `INVALID_TIMEOUT` | timeoutMs out of `[0, 86400000]` | no |
| `INVALID_SNAPSHOT` | snapshot source not a string / not canonicalizable | no |

## Snapshot Contract A (exact normalized HTML-string)

- Input to `capture()` **must be a string**; otherwise `INVALID_SNAPSHOT`.
- Leading/trailing whitespace is **trimmed**; it is insignificant.
- Internal whitespace, HTML attribute order, tag names, text, and nested
  structure are **all significant** — this is exact HTML-text comparison.
- Attribute order is meaningful: `<a href="y" id="x">` and `<a id="x" href="y">`
  are **not** equal.
- This is **NOT** structural DOM normalization (no DOM parser). Malformed HTML
  is treated as text per the trimmed-string contract.
- The canonical form is the key-stable string of `{ html: normalizedHtml }`:
  object key order is normalized; the HTML content inside `html` is **not**.
- Snapshots and `diff()` results are **frozen (immutable)**; equality is
  deterministic.

## Canonicalization contract (self-contained subset)

Browser Assertions uses a self-contained deterministic canonicalization **subset**
tailored to its `{ html: string }` snapshot payload and derived from the semantics
of the Sovereign `canonical-json` cube. It is **not** the full `canonical-json`
cube and intentionally exposes no tunable limits/config.

Preserved guarantees (reachable through the snapshot public API):
- deterministic, key-sorted serialization
- finite-number handling (NaN/Infinity are rejected, never coerced to `null`)
- `-0` preservation
- plain-object rule (Date/Map/Set/class instances rejected)
- accessor-property rejection (getters are **not** invoked)
- circular-reference detection
- bounded recursion: depth / node / string / value limits

This helper is **internal**; `canonicalStringify` / `CanonicalizeError` are not
part of the public API.

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

## Status

**v0.1 — implemented, unit-tested, CI-pending.**
