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

### Logger / Diagnostics Cube v0.1 — RELEASED
Implemented with Node.js runtime primitives only. Verified on Ubuntu, Windows, and macOS-15-Intel with logger contract/integration/failure tests and the real Browser smoke test. Release-gate Run 150 passed all jobs.

### Configuration / Environment Cube v0.1 — RELEASED
Implemented with Node.js runtime primitives only. Verified on Ubuntu, Windows, and macOS-15-Intel with configuration contract/integration/failure tests and the real Browser smoke test. Release-gate Run 155 passed all jobs.

### Cache / Memoization Cube v0.1 — RELEASED
Implemented with Node.js runtime primitives only. Verified on Ubuntu, Windows, and macOS-15-Intel with cache contract/integration/failure tests and the real Browser smoke test. Release-gate Run 161 passed all jobs.

## Active milestone

### Validation / Schema Cube v0.1

Target: standalone validation and schema primitives that normalize and validate structured inputs without third-party schema frameworks, designed to compose with the Data Engine and Configuration Cube while remaining independently reusable.

Initial scope:
- typed primitive validation
- object and array shape validation
- required and optional fields
- nested paths
- enums and literal constraints
- string/number bounds
- array length bounds
- custom deterministic validators
- structured validation results
- typed validation errors
- coercion only when explicitly requested
- safe handling of unknown keys
- deterministic error paths/messages/codes
- reusable schema definitions
- local unit/integration/failure/recovery tests
- cross-platform verification

Out of scope until v0.2+:
- JSON Schema full standard implementation
- OpenAPI generation
- code generation
- remote schema registries
- third-party schema libraries
- ORM validation
- UI form generation
- localization framework

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
