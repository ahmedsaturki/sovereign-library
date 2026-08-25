# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

All previously released cubes remain frozen on `main`, including Circuit Breaker / Health Gate v0.1.

## Active milestone

### Timeout / Deadline Cube v0.1

Target: a standalone deterministic timeout/deadline primitive that composes cleanly with HTTP, Process, Scheduler, Retry, Rate Limiter, Bulkhead, Circuit Breaker, Result/Error, and AbortSignal without a third-party timeout framework.

Initial scope:
- deadline creation from duration or absolute monotonic deadline
- remaining-time calculation
- AbortSignal integration
- deterministic clock support including deterministic timers
- timeout error with explicit deadline metadata
- race-safe completion/timeout/cancellation semantics
- child deadline derivation
- immutable deadline snapshots
- cleanup and timer lifecycle
- local unit/integration/failure/recovery tests
- cross-platform verification

Out of scope until v0.2+:
- distributed deadlines
- tracing backend
- remote coordination
- adaptive timeouts
- third-party timeout libraries
- workflow orchestration

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
