# sovereign-retry — Python v0.1

Native, dependency-free Python implementation of the Sovereign Retry contract.

## API

- `RetryError`
- `FakeClock`
- `RealClock`
- `create_retry_policy`
- `RetryRunner`

The port provides fixed, linear, and exponential backoff; capped delays; deterministic injected jitter; retryability predicates; per-attempt timeout handling; total retry budgets; cancellation; attempt history; and a production wall-clock adapter.

Runtime dependencies: Python standard library only.

## Development

```bash
python -m pytest tests -q
```

Requires Python 3.9+.
