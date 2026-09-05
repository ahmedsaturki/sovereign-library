# Browser Visual Testing Cube v0.1

## Purpose

Structural DOM snapshot capture + deterministic diffing for regression testing.
The Sovereign equivalent of Cypress `.snapshot()` / Playwright `toMatchAriaSnapshot`
— but zero-dependency and offline, capturing canonical, attribute/whitespace-
normalized HTML so diffs are meaningful and stable.

## Scope (v0.1)

- `capture(html)` normalizes HTML (lowercases tags, sorts attributes, trims text)
  into a canonical string for stable comparison.
- `diff(before, after)` returns added/removed/changed nodes in a bounded report.
- `baseline(name, html)` / `compare(name, html)` for golden-file style tests.
- Deterministic error taxonomy; no browser required to test.

## Non-goals (v0.1)

- Pixel/screenshot diffing (separate cube using browser screenshot).
- Visual AI diffing.

## Definition of done

- [ ] `node --check src/index.js` clean.
- [ ] Unit tests pass standalone.
- [ ] Zero runtime third-party dependencies.
