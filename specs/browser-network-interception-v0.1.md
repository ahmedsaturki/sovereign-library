# Browser Network Interception Cube v0.1

## Purpose

Intercept, block, mock, and observe network traffic at the CDP layer — the
Sovereign equivalent of Puppeteer/Playwright `page.route` interception, but
zero-dependency and standalone.

## Scope (v0.1 — truthful)

- Hook the CDP **Fetch** domain (`Fetch.enable` → `Fetch.requestPaused` →
  `Fetch.fulfillRequest` / `Fetch.continueRequest` / `Fetch.failRequest`) to
  actually intercept requests in a real browser. The Fetch domain — not the
  passive `Network` domain — is the correct CDP mechanism for interception and
  mocking.
- **Block** requests matching a URL pattern (`Fetch.failRequest`).
- **Mock/respond** with a caller-supplied body + status for routes that match
  (`Fetch.fulfillRequest`). The mock body is whatever the route provides; it is
  base64-encoded per the CDP contract.
- **Pass-through** requests that match no route (`Fetch.continueRequest`).
- Build a deterministic, serializable **traffic log** of intercepted requests:
  method, url, status (when observed), mimeType, headers, timestamp, bodyLength.
- Route matching by glob-style URL pattern (`**`, `*`, or prefix match).
- Bounded mock-body size via `bodyCapBytes` (default 64 KiB); oversized mock
  bodies fail closed with `BODY_CAP_EXCEEDED`.
- Deterministic error taxonomy; capability-injectable (testable with a fake CDP).
- Cross-platform; no native deps beyond Node.js built-ins.

## Explicitly NOT in v0.1 (future architecture)

- **Real response-body capture.** v0.1 does NOT fetch or decode real response
  bodies. The traffic-log `body` field is always `null`; only `bodyLength` is
  tracked, and only for mock responses (where the body is caller-supplied).
  Real body capture would require `Fetch.getResponseBody` + decoding and is
  deferred to v0.2.
- WebSocket traffic interception (v0.2).
- HTTP/2 prioritization (v0.2).
- Browser-context-wide (multi-tab) interception (v0.2 — needs tab manager).

## Definition of done

- [x] `node --check src/index.js` clean.
- [x] Unit tests pass with a fake CDP connection (no browser required), exercising
      the real Fetch-domain command vocabulary.
- [x] Interception (block / respond / pass-through) reproduces deterministically.
- [x] Zero runtime third-party dependencies.
- [x] Errors carry stable `code` + `retryable`.
