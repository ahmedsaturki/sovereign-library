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

## Active milestone

### Storage Cube v0.1

Target: standalone local storage product using Node.js standard-library filesystem and serialization primitives only.

Initial scope:
- namespace/key storage
- JSON-safe values
- atomic persistence
- get/set/delete/has/list
- TTL metadata with deterministic expiry checks
- size limits
- corrupt-record detection
- deterministic typed errors
- local integration/failure tests
- Windows/Linux/macOS verification

Out of scope until v0.2+:
- database engines
- cloud storage
- external SDKs
- network replication
- distributed locking
- background compaction workers

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
