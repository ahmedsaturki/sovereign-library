# HTTP Client Cube v0.1

Standalone native HTTP client with zero runtime third-party dependencies.

## Example

```js
import { get, post, text, json } from './src/index.js';

const page = await get('https://example.com');
console.log(page.status, text(page));

const created = await post('https://example.com/api', { name: 'Sovereign' }, {
  timeoutMs: 10000,
  maxResponseBytes: 2 * 1024 * 1024
});
console.log(created.status, json(created));
```

## Native foundations

The cube uses Node.js `node:http` and `node:https` directly. It does not depend on Axios, got, request, an HTTP SDK, Express, or another Sovereign cube.

## v0.1 behavior

Requests support GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS; headers; string/Buffer/Uint8Array/JSON bodies; timeouts; `AbortSignal`; response limits; explicit bounded redirects; deterministic errors; and response text/JSON helpers.

Redirect following is disabled by default. Cross-protocol redirects require explicit opt-in.

## Scope discipline

HTTP/2, proxy pools, automatic cookie persistence, transparent retries, and framework adapters are outside v0.1 and require separate release gates if they are ever added.
