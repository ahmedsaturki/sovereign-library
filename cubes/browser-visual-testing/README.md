# Browser Visual Testing Cube

A standalone, dependency-free structural DOM snapshot capture + diffing layer for
regression testing. Zero third-party dependencies.

## What v0.1 provides

- `VisualTester.capture(html)` normalizes HTML (lowercase tags, sorted attributes,
  sorted class tokens, trimmed text) into a canonical, stable snapshot string.
- `VisualTester.diff(before, after)` returns a bounded structural report
  (added/removed nodes, equal flag).
- `baseline(name, html)` / `compare(name, html)` for golden-file style tests.
- Deterministic error taxonomy with stable `code`.

## Status

**v0.1 — implemented, unit-tested, CI-pending.**
