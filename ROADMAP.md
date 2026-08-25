# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

All previously released cubes remain frozen on `main`, including Timeout / Deadline v0.1.

## Active milestone

### HTTP Server / Router Cube v0.1

Target: a standalone native HTTP server and router built only on Node.js standard-library primitives, providing a compact Express-like server contract without Express or any third-party runtime dependency.

Initial scope:
- native HTTP/HTTPS server creation
- deterministic method/path routing
- path parameters
- query parsing
- request body limits
- JSON/text response helpers
- status and header management
- middleware pipeline with explicit ordering
- async handler support
- centralized error handling
- 404 and method-not-allowed behavior
- AbortSignal/request lifecycle propagation where supported
- graceful close and connection cleanup
- immutable route/response metadata snapshots
- local unit/integration/failure/recovery tests
- real HTTP integration tests
- cross-platform verification

Out of scope until v0.2+:
- WebSocket upgrade handling (use WebSocket Cube)
- multipart parser
- sessions/cookies framework
- authentication/authorization framework
- compression framework
- templating engine
- reverse proxy
- distributed server state
- third-party web frameworks

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
