# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Browser Cube v0.1 — RELEASED

Verified on Ubuntu, Windows, and macOS with a real Chromium smoke test.

### HTTP Client Cube v0.1 — RELEASED

Implemented with Node.js standard-library `node:http` and `node:https` only. Verified on Ubuntu, Windows, and macOS with HTTP integration tests and the real Browser smoke test. Release-gate Run 45 passed all jobs.

### Filesystem Cube v0.1 — RELEASED

Implemented with Node.js standard-library `fs/promises` and `path` only. Verified on Ubuntu, Windows, and macOS with filesystem integration/failure tests and the real Browser smoke test. Release-gate Run 58 passed all jobs.

### Process / Command Cube v0.1 — RELEASED

Implemented with Node.js standard-library `child_process` only. Verified on Ubuntu, Windows, and macOS with process integration/failure tests and the real Browser smoke test. Release-gate Run 68 passed all jobs.

### Data Engine Cube v0.1 — RELEASED

Implemented with Node.js language/runtime primitives only. Verified on Ubuntu, Windows, and macOS with data unit/failure tests and the real Browser smoke test. Release-gate Run 90 passed all jobs.

### Storage Cube v0.1 — RELEASED

Implemented with Node.js standard-library filesystem, serialization, and crypto primitives only. Verified on Ubuntu, Windows, and macOS with storage integration/failure tests and the real Browser smoke test. Release-gate Run 98 passed all jobs.

## Active milestone

### WebSocket / Transport Cube v0.1

Target: standalone bidirectional WebSocket client/server transport using native Node.js networking primitives only, without `ws`, Socket.IO, HTTP frameworks, or third-party networking packages.

Initial scope:
- client connection lifecycle
- server-side upgrade/accept path
- WebSocket frame encode/decode
- masking/unmasking
- text/binary messages
- ping/pong
- close handshake
- protocol validation
- payload limits
- backpressure
- deterministic typed errors
- local client/server integration tests
- malformed-frame/failure tests
- Windows/Linux/macOS verification

Out of scope until v0.2+:
- automatic reconnection policy
- pub/sub broker
- authentication framework
- distributed presence
- third-party WebSocket libraries
- message persistence

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
