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

### WebSocket / Transport Cube v0.1 — RELEASED
Implemented with Node.js standard-library networking and crypto primitives only. Verified on Ubuntu, Windows, and macOS-15-Intel with WebSocket contract/integration tests and the real Browser smoke test. Release-gate Run 122 passed all jobs.

### Task Scheduler / Queue Cube v0.1 — RELEASED
Implemented with Node.js runtime primitives only. Verified on Ubuntu, Windows, and macOS-15-Intel with scheduler contract/integration/failure/recovery tests and the real Browser smoke test. Release-gate Run 132 passed all jobs.

### Event / Signal Cube v0.1 — RELEASED
Implemented with Node.js runtime primitives only. Verified on Ubuntu, Windows, and macOS-15-Intel with event contract/integration/failure/recovery tests and the real Browser smoke test. Release-gate Run 139 passed all jobs.

## Active milestone

### Logger / Diagnostics Cube v0.1

Target: standalone structured logging and diagnostics primitives for all cubes, using only Node.js runtime primitives and with deterministic behavior in tests.

Initial scope:
- typed log records
- levels: trace/debug/info/warn/error/fatal
- deterministic record shape
- context fields
- correlation/request/task identifiers
- pluggable sinks via a tiny native contract
- console sink
- in-memory sink for tests
- minimum-level filtering
- error normalization
- safe serialization limits
- timestamp/monotonic timing separation
- child logger context
- graceful sink failure isolation
- local unit/integration/failure tests
- cross-platform verification

Out of scope until v0.2+:
- remote log transport
- distributed tracing backend
- OpenTelemetry SDKs
- third-party logging frameworks
- persistence
- log aggregation/query engine
- metrics backend
- external observability SaaS

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
