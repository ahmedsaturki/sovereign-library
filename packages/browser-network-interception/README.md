# Browser Network Interception Cube

A standalone, dependency-free network interception layer for the Sovereign
Browser Cube. Zero third-party dependencies — only the browser session contract.

## What v0.1 provides

- `NetworkInterceptor(cdp)` wraps any CDP connection (`on()`/`send()`).
- `enable()` enables the CDP **Fetch** domain (the correct interception
  mechanism) and starts intercepting requests.
- `addRoute({ pattern, action: 'block'|'respond', ... })` registers intercepts
  with glob-style URL patterns (`**`, `*`, or prefix match).
- **Block**: matching requests fail at the network layer (`Fetch.failRequest`).
- **Mock/respond**: matching requests are answered with a caller-supplied body +
  status (`Fetch.fulfillRequest`).
- **Pass-through**: requests that match no route continue normally
  (`Fetch.continueRequest`).
- `snapshot()` returns a frozen, serializable traffic log (method, url, status,
  mimeType, headers, timestamp, bodyLength).
- Bounded mock-body size via `bodyCapBytes` option (default 64 KiB).
- Deterministic error taxonomy with stable `code` + `retryable`.

## What v0.1 does NOT do (future architecture)

- **Real response-body capture.** The traffic-log `body` field is always `null`.
  Only `bodyLength` is tracked, and only for mock responses (where the body is
  caller-supplied). Real body capture (`Fetch.getResponseBody` + decoding) is
  deferred to v0.2.
- This is interception *control* at the capability boundary — not a transparent
  proxy. It will block, mock, or pass-through real requests, but it does not
  capture or rewrite real upstream response bodies.

## Usage

```js
import { BrowserSession } from '@sovereign/browser-cube';
import { NetworkInterceptor } from '@sovereign/browser-network-interception';

const browser = await launch();
const session = new BrowserSession(); // ...started...
const net = new NetworkInterceptor(session.cdp);
await net.enable();
await net.addRoute({ pattern: '**/analytics/*', action: 'block' });
await net.addRoute({ pattern: '**/api/mock', action: 'respond', status: 200, body: '{"ok":true}' });

// ... run browser work ...
const traffic = net.snapshot();
await net.destroy();
```

## Error codes

| Code | Meaning |
|------|---------|
| `INVALID_CDP` | not a valid CDP connection |
| `INVALID_ROUTE` | bad route definition |
| `INVALID_ROUTE_ACTION` | action not block/respond |
| `BODY_CAP_EXCEEDED` | mock body exceeds `bodyCapBytes` |

## Status

**v0.1 — implemented, unit-tested, CI-pending.**
