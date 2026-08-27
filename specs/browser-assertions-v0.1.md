# Browser Assertions Cube v0.1

## Purpose

Assertion + snapshot layer for browser interactions. **Zero runtime
dependencies** — including zero internal monorepo-source dependencies. The
package is self-contained: it carries its own key-stable canonicalization
primitive — a documented **subset** of the Sovereign `canonical-json` cube —
so a published/installed `browser-assertions` package works without access to the
monorepo filesystem layout. The subset faithfully preserves every canonical-json
guarantee reachable through the `{ html: string }` snapshot input: deterministic
key-sorted output, finite-number handling (NaN/Infinity rejected), `-0`
preservation, the plain-object rule (Date/Map/Set/class rejected), accessor
rejection, circular-reference detection, and bounded recursion (depth / node /
string / value limits). It intentionally does NOT expose tunable limits or
custom config; those are out of scope for the snapshot path. This satisfies the package contract's tarball
boundary (no undeclared dependency or monorepo path may enter the artifact).

## Scope (v0.1)

- `expect(locator)` with: `toBeVisible`, `toBeHidden`, `toBeEnabled`,
  `toBeDisabled`, `toHaveText`, `toHaveValue`, `toHaveAttribute`, `toHaveCount`.
- Auto-retrying assertions (bounded deadline) **that respect the `retryable`
  classification** of each assertion error.
- Soft assertions (v0.1 minimal contract — see below).
- Snapshot capture + stable comparison using the package's self-contained canonicalizer (a documented subset of the `canonical-json` cube).

## Retry semantics (authoritative)

The retry loop MUST NOT blindly retry every thrown error.

- **Retryable assertion failures** are retried until the deadline:
  `NOT_VISIBLE`, `NOT_ENABLED`, `TEXT_MISMATCH`, `VALUE_MISMATCH`,
  `ATTRIBUTE_MISMATCH`, `COUNT_MISMATCH`.
- **Non-retryable failures surface immediately** (no polling, minimal delay):
  `NOT_HIDDEN`, `NOT_DISABLED` (state-flipped hard failures), `INVALID_OPTION`
  (bad attribute name / bad count / bad options — validated before any locator
  call), `INVALID_TIMEOUT`, `INVALID_SNAPSHOT`.
- **Unexpected (non-`AssertionsError`) errors** from the locator/session
  propagate immediately and are NOT retried or wrapped. The caller sees the
  original error.
- `AssertionsError` with `retryable:false` is always surfaced once, never
  retried.
- After the deadline, the last error is thrown (or collected, in soft mode).
- The sleep between attempts never exceeds the remaining deadline.

## Timeout validation

`timeoutMs` is validated at construction:

- must be a finite integer in `[0, 86400000]` (0–24h);
- `NaN`, `Infinity`, negative, fractional, or >24h → throws `INVALID_TIMEOUT`
  (non-retryable) immediately.

`timeoutMs = 0` is allowed and means "evaluate once, no polling".

## Soft assertions (v0.1 contract — Option B, minimal coherent API)

v0.1 intentionally provides a **minimal** soft-assertion lifecycle, not a full
collector framework:

- Construct with `{ soft: true }`.
- Soft assertion failures are collected instead of thrown.
- Public API:
  - `softErrors()` → frozen array of collected `AssertionsError`s, in insertion
    order (empty array if none).
  - `hasSoftErrors()` → boolean.
  - `clearSoftErrors()` → resets the collection.
- No hidden global state; the collection is per-`LocatorAssertions` instance.

A full external assertion-context / report object is a future scope and is NOT
claimed as implemented.

## Snapshot Contract A (exact normalized HTML-string)

v0.1 snapshot is **Contract A: exact normalized HTML-string**, NOT structural DOM
normalisation.

- Source HTML is **trimmed**; leading/trailing whitespace is insignificant.
- The canonical form is the key-stable string (a documented subset of the
  `canonical-json` cube contract) of `{ html }` (deterministic, object
  key-stable). This normalises **object key order**, NOT the HTML attribute
  order inside the string.
- Attribute order in the source HTML is **meaningful** (exact HTML-text contract):
  `<a href="y" id="x">` and `<a id="x" href="y">` are NOT equal.
- Internal/meaningful whitespace inside the HTML is **preserved** (not
  normalised) — this is exact HTML-text comparison.
- Equality is exact: tag changes, text changes, attribute value changes, nested
  structure changes are all detected.
- `capture()` throws `INVALID_SNAPSHOT` (non-retryable) for non-string input.
- Returned snapshot and `diff()` result objects are frozen (immutable).

> NOTE: "structural DOM snapshot" / "visual diff" is explicitly a NON-GOAL for
> v0.1 (separate `browser-visual-testing` cube covers DOM-structural diffing).
> The phrase "structural (key-stable) equality" refers to *key-stable
> canonicalisation of the HTML string*, not DOM-tree normalisation.

## Error taxonomy

| code | retryable | meaning |
|------|-----------|---------|
| NOT_VISIBLE | yes | element not visible |
| NOT_HIDDEN | no | element visible but expected hidden (hard state failure) |
| NOT_ENABLED | yes | element not enabled |
| NOT_DISABLED | no | element enabled but expected disabled (hard state failure) |
| TEXT_MISMATCH | yes | text content mismatch |
| VALUE_MISMATCH | yes | input value mismatch |
| ATTRIBUTE_MISMATCH | yes | attribute value mismatch |
| COUNT_MISMATCH | yes | element count mismatch |
| INVALID_OPTION | no | invalid matcher option (validated pre-evaluation) |
| INVALID_TIMEOUT | no | timeoutMs out of allowed range |
| INVALID_SNAPSHOT | no | snapshot source not a string / not canonicalisable |

## Non-goals (v0.1)

- Visual/pixel snapshot diffing (separate cube).
- Custom matcher plugins (future).
- Full external soft-assertion report context (future).

## Definition of done

- [x] `node --check src/index.js` clean.
- [x] Unit tests pass with a fake `BrowserInteractions` locator (no browser).
- [x] Errors carry `code` + `retryable`; classification is respected by retry.
- [x] Zero runtime third-party dependencies (canonical-json is internal).
- [x] Cross-platform (no platform-specific code).
- [x] SPEC == implementation == tests == documentation.
