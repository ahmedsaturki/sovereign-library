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

## Active milestone

### Data Engine Cube v0.1

Target: standalone data-processing product using Node.js language/runtime primitives only.

Initial scope:
- nested get/set
- pick/omit
- compact values
- string normalization
- deterministic deduplication
- deep merge
- canonical JSON serialization
- deterministic typed errors
- isolated pure transformations
- unit/failure tests
- Windows/Linux/macOS verification

Out of scope until v0.2+:
- databases
- ORM
- network ingestion
- schema registry service
- third-party data-processing packages
- persistent workers

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
