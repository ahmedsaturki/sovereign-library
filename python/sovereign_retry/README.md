# Retry / Resilience Cube v0.1 — Native Python Port

Standalone deterministic retry runner with native backoff, jitter, budgets, timeouts, and cooperative cancellation.

## Guarantees

- Pure Python standard library only.
- Fixed, linear, and exponential backoff.
- Injectable deterministic randomness for jitter.
- Maximum attempt and total-budget controls.
- Attempt-level timeout with AbortSignal-like propagation.
- Retryability determined by a caller-supplied classifier.
- Immutable attempt history snapshots.
- Deterministic clock injection.
- No coupling to Logger, HTTP, Scheduler, or any third-party library.

## Installation

```bash
pip install sovereign-retry
```

## Usage

```python
from sovereign_retry import create_retry_policy, RetryRunner

policy = create_retry_policy(
    max_attempts=5,
    base_delay_ms=250,
    backoff="exponential",
)

runner = RetryRunner(policy)

# With a real clock (default)
result = await runner.run(async_operation)

# With a fake clock for testing
from sovereign_retry import FakeClock
clock = FakeClock(0)
runner = RetryRunner(policy, clock=clock)
result = await runner.run(async_operation)
```

## API

### `create_retry_policy(**options) -> Policy`

Creates an immutable retry policy.

Options:
- `max_attempts` (int, default: 3) — Maximum number of attempts.
- `base_delay_ms` (int, default: 100) — Base delay in milliseconds.
- `backoff` (str, default: "exponential") — "fixed", "linear", or "exponential".
- `factor` (float, default: 2.0) — Backoff factor for exponential.
- `max_delay_ms` (int, default: 30000) — Maximum delay cap in milliseconds.
- `jitter` (str, default: "none") — "none", "full", or "bounded".
- `random` (callable, default: random.random) — Random function for jitter.
- `total_budget_ms` (int/float, default: inf) — Total time budget for all attempts.
- `retryable` (callable, default: lambda e: e.retryable is True) — Classifier function.

### `RetryRunner(policy, *, clock=None)`

Creates a retry runner with the given policy and clock.

Methods:
- `run(operation, *, signal=None, attempt_timeout_ms=inf)` — Run the operation with retry logic.

### `RetryError`

Exception raised when retry operation fails definitively.

Attributes:
- `code` (str) — Error code: "RETRY_EXHAUSTED", "TIMEOUT", "BUDGET_EXCEEDED", "CANCELLED", etc.
- `attempts` (int) — Number of attempts made.
- `retryable` (bool) — Whether the error is retryable.
- `timed_out` (bool) — Whether the error was due to a timeout.
- `cancelled` (bool) — Whether the operation was cancelled.
- `last_error` (Exception) — The last error that caused the failure.

### `RealClock` / `FakeClock`

Clock implementations for production and testing.

### `AbortController` / `AbortSignal`

Python equivalents of DOM AbortController/AbortSignal for cooperative cancellation.

## License

Apache-2.0