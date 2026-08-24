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

## Active milestone

### Filesystem Cube v0.1

Target: standalone filesystem product using Node.js standard-library filesystem/path primitives only.

Initial scope:
- read/write text and bytes
- atomic writes
- append
- copy/move
- exists/stat
- directory listing
- recursive directory operations
- safe path handling
- deterministic typed errors
- limits for read/write sizes
- cancellation where supported
- local fixture tests
- failure/recovery tests
- Windows/Linux/macOS verification

Out of scope until v0.2+:
- database semantics
- virtual filesystem drivers
- cloud storage SDKs
- file watching unless required by a proven release-gate use case

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
