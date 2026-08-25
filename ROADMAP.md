# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

All previously released cubes remain frozen on `main`, including MIME / Multipart v0.1.

HTTP Server / Router v0.1 was verified on Ubuntu, Windows, and macOS-15-Intel with syntax, contract/integration, failure/recovery coverage, and the real Browser smoke test. Release-gate Run 240 passed all jobs and the cube was squash-merged as `77a668d5b56591b62f748b16235a318b3be724c3`.

MIME / Multipart v0.1 was verified on Ubuntu, Windows, and macOS-15-Intel with MIME contract/integration/failure/recovery tests and the real Browser smoke test. Release-gate Run 249 passed all jobs and the cube was squash-merged as `a6614ea0b8c212791107fc4d73295cb7cc502607`.

## Active milestone

### HTTP Headers / Cookies / Content Negotiation Cube v0.1

Target: a standalone native HTTP metadata primitive for normalized request/response headers, cookies, content negotiation, and cache-relevant header semantics without a third-party HTTP utility framework.

Initial scope:
- case-insensitive header storage with deterministic normalization
- multi-value header semantics where applicable
- safe request/response header validation
- Cookie header parsing
- Set-Cookie builder with bounded attributes
- Accept / Accept-Encoding / Accept-Language negotiation helpers
- Content-Type / Content-Length parsing helpers
- ETag / conditional request helpers
- immutable metadata snapshots
- deterministic malformed-value errors
- local unit/integration/failure/recovery tests
- cross-platform verification

Out of scope until v0.2+:
- cookie jar persistence
- authentication/session framework
- compression implementation
- HTTP cache storage engine
- proxy behavior
- browser cookie policy emulation
- third-party header utility libraries

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
