# Browser Network Interception Cube

A standalone, dependency-free network interception layer for the Sovereign
Browser Cube. Zero third-party dependencies — only the browser session contract.

## What v0.1 provides

- `NetworkInterceptor(cdp)` wraps any CDP connection (`on()`/`send()`).
- `enable()` enables `Network` domains and starts logging.
- `addRoute({ pattern, action: 'block'|'respond', ... })` registers intercepts
  with glob-style URL patterns (`**`, `*`, or prefix match).
- `snapshot()` returns a frozen, serializable traffic log (method, url, status,
  mimeType, headers, timestamp, bodyLength).
- Bounded body capture via `bodyCapBytes` option (default 64 KiB).
- Deterministic error taxonomy with stable `code` + `retryable`.

## Usage

```js
import { BrowserSession } from '@sovereign/browser-cube';
import { NetworkInterceptor } from '@sovereign/browser-network-interception';

const browser = await launch();
const session = new BrowserSession(); // ...started...
const net = new NetworkInterceptor(session.cdp);
await net.enable();
await net.addRoute({ pattern: '**/analytics/*', action: 'block' });
await net.addRoute({ pattern: '**/api/mock', action: 'respond', status: 200, body: { ok: true } });

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

## Status

**v0.1 — implemented, unit-tested, CI-pending.**
