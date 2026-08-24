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

## Active milestone

### Task Scheduler / Queue Cube v0.1

Target: standalone deterministic task scheduling and in-memory queue primitives using Node.js runtime primitives only, without workflow frameworks, queue packages, Redis clients, cron libraries, or third-party dependencies.

Initial scope:
- task contract and lifecycle states
- FIFO queue with explicit priorities
- bounded concurrency
- deterministic scheduling
- delay/not-before execution
- retries with explicit retry policy
- cancellation and timeout
- backpressure and queue limits
- idempotency keys
- task result/error capture
- graceful shutdown and drain
- deterministic clock injection for tests
- local integration/failure/recovery tests
- cross-platform verification

Out of scope until v0.2+:
- distributed queues
- persistence
- cron parser
- workflow DAG engine
- pub/sub
- distributed locks
- remote workers
- third-party queue services

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
