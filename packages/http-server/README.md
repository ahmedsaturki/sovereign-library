# HTTP Server / Router Cube v0.1

Native standalone HTTP server and router built on Node.js `node:http` and `node:https` only.

## Included

- method/path routing with `:params` and terminal `*` wildcards
- deterministic 404 / 405 behavior with `Allow`
- GET-to-HEAD fallback with body suppression
- query parsing
- bounded request-body reading and JSON parsing
- text/JSON response helpers
- ordered async middleware
- centralized error handling
- request lifecycle `AbortSignal`
- graceful server close
- zero runtime third-party dependencies

## Example

```js
import { createServer } from './src/index.js';

const app = createServer();
app.get('/health', ctx => ctx.jsonResponse({ ok: true }));
app.get('/users/:id', ctx => ctx.jsonResponse({ id: ctx.params.id }));

const server = app.listen({ port: 8080, host: '127.0.0.1' });
await server.listening;
```

v0.1 intentionally excludes WebSocket upgrades, multipart, sessions, authentication, templating, compression, reverse proxying, and distributed state.
