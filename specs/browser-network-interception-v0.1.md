# Browser Network Interception Cube v0.1

## Purpose

Intercept, inspect, mock, and analyze network traffic at the CDP layer — the
Sovereign equivalent of Puppeteer/Playwright `page.route`/CDP
`Network.setRequestInterception`, but zero-dependency and standalone.

## Scope (v0.1)

- Hook CDP `Network.requestWillBeSent` and `Network.responseReceived` to build a
  deterministic traffic log.
- Route/mocking by URL pattern (block, abort, respond with custom body/status).
- Per-request metadata: method, url, status, mimeType, headers, body (capped).
- Bounded body capture (configurable byte cap) to avoid memory blowup.
- Deterministic error taxonomy; capability-injectable (testable with a fake CDP).
- Cross-platform; no native deps beyond node: built-ins.

## Non-goals (v0.1)

- WebSocket traffic interception (v0.2).
- HTTP/2 prioritization (v0.2).
- Browser-context-wide (multi-tab) interception (v0.2 — needs tab manager).

## Definition of done

- [ ] `node --check src/index.js` clean.
- [ ] Unit tests pass with a fake CDP connection (no browser required).
- [ ] Traffic log + mocking reproduce deterministically.
- [ ] Zero runtime third-party dependencies.
- [ ] Errors carry stable `code` + `retryable`.
