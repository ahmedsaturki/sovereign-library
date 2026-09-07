# Browser Tab Manager Cube

A standalone, dependency-free multi-tab orchestration layer for the Sovereign
Browser Cube. Zero third-party dependencies — only the CDP `Target` domain.

## What v0.1 provides

- `TabManager(cdp)` wraps any CDP connection (`on()`/`send()`).
- `enable()` indexes existing targets and tracks create/destroy/info events.
- `open(url)` creates + attaches a new tab, returns a session handle.
- `close(targetId)` closes a tab; `list()` returns frozen snapshots.
- `getActive()` returns the active tab's session.
- Deterministic error taxonomy with stable `code` + `retryable`.

## Status

**v0.1 — implemented, unit-tested, CI-pending.**
