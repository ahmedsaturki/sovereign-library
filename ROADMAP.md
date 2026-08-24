# Sovereign Library Roadmap

## Released — v0.1 Browser Cube

**Status:** RELEASED

Browser Cube v0.1 is the first completed standalone product in the catalog.

Verified gates:

- [x] standalone product contract
- [x] native Chromium/CDP foundation
- [x] launch/attach lifecycle
- [x] navigation
- [x] page evaluation
- [x] metadata
- [x] screenshot
- [x] deterministic errors
- [x] cleanup
- [x] contract/unit tests
- [x] real browser smoke test
- [x] Windows CI verification
- [x] Linux CI verification
- [x] macOS CI verification
- [x] CI test path verified from a clean GitHub checkout

The repository remains intentionally dependency-free at runtime: Browser Cube uses Node.js built-ins plus Chromium/CDP and has no Puppeteer, Playwright, Selenium, Axios, Express, or SDK runtime dependency.

## Active milestone

`HTTP-CUBE-V0.1`

**Only immediate goal:** build one complete, standalone native HTTP Client Cube. Do not expand into other cubes until this release gate passes.

### HTTP Cube v0.1 scope

- request lifecycle
- GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS
- URL and method validation
- request headers
- request body
- response status / headers / body
- text and JSON helpers
- timeout
- abort/cancellation
- response size limits
- explicit redirect policy
- correct 301/302/303/307/308 method semantics
- protocol-change redirect guard
- basic diagnostics
- deterministic typed errors
- unit + integration + failure tests
- clean example
- cross-platform CI

### Explicit non-goals for v0.1

- HTTP/2 implementation
- proxy pool
- cookie jar automation
- retries with hidden side effects
- framework integration
- authentication SDKs
- third-party runtime packages

Those are separate future slices only if later proven necessary.

## Lessons extracted from Omni-Agent-Core

The imported archive is treated as research material, not as a dependency or a code source of record.

Useful patterns to reimplement natively where justified:

- execution queue / retry / pipeline semantics
- deterministic task states and execution logs
- local data normalization, hashing, deduplication, atomic persistence
- reporting and diagnostics concepts
- environment/health checks

Explicitly excluded from the Sovereign core:

- Puppeteer/Playwright wrappers
- Express-based gateways
- third-party SDK dependencies
- third-party MCP SDK dependency
- stealth/evasion implementation
- unbounded feature aggregation

## Next cubes — parked

1. Filesystem Cube
2. Process/Command Cube
3. Data Engine Cube
4. Storage Cube
5. Scheduler/Task Runner Cube
6. WebSocket Cube
7. HTTP Server Cube
8. CLI Cube
9. Reporting Cube
10. Search Cube
11. Workflow Cube
12. AI Cube
13. Agent Cube

The order changes only through an explicit decision after the active cube is released.

## Non-negotiable project rule

**One cube at a time. One active milestone. One immediate next task.**

Every cube follows:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is not complete because code exists. It is complete only when its release gates pass.
