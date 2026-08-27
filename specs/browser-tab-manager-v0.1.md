# Browser Tab Manager Cube v0.1

## Purpose

Multi-tab / multi-context orchestration for the Sovereign Browser Cube. The
Sovereign equivalent of Playwright BrowserContext / Puppeteer multiple pages — but
zero-dependency, deterministic, and capability-injectable.

## Scope (v0.1)

- Open/close/select tabs via CDP Target domain.
- List active targets with bounded metadata.
- Per-tab isolated interaction facade (compose with browser-interactions).
- Deterministic error taxonomy; testable with a fake CDP.

## Non-goals (v0.1)

- Cross-browser context isolation policies (v0.2).
- Incognito/profile isolation (v0.2).

## Definition of done

- [ ] `node --check src/index.js` clean.
- [ ] Unit tests pass with a fake CDP.
- [ ] Zero runtime third-party dependencies.
- [ ] Errors carry stable `code` + `retryable`.
