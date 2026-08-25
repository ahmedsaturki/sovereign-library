# Execution Engine Cube v0.1

## Contract

Standalone deterministic local execution engine for small task graphs.

### Guarantees
- Task definitions are normalized and never mutated by the engine.
- Dependencies are validated, cycles are rejected, and ready tasks execute in deterministic id order.
- Every task has explicit lifecycle state: `pending`, `running`, `succeeded`, `failed`, `cancelled`, `timed_out`, or `skipped`.
- A task may retry deterministically up to `maxRetries` after failure/timeout.
- Dependency failure causes downstream tasks to become `skipped`.
- Cancellation is fail-closed and prevents new work from starting.
- Execution is bounded by task count, payload bytes, dependency depth, attempts, and diagnostics bytes.
- Results and snapshots are immutable.
- Runtime dependencies: none.

## Public API

`createExecutionEngine(definition, options)` returns an engine with `run()`, `cancel()`, and `snapshot()`.

A task is `{ id, dependsOn?, run, maxRetries?, timeoutMs? }`.

`run({ input? })` returns an immutable execution record containing task states, attempts, outputs/errors, and overall status.

The engine does not provide a scheduler, remote worker, queue broker, network orchestration, or browser integration.

## Definition of done

Contract, normal-path, malformed-definition, cycle, cancellation, timeout, retry, dependency-failure, bounds, immutability, recovery, and cross-platform tests pass with GitHub Actions and the repository browser smoke gate.
