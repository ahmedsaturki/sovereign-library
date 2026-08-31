# sovereign-circuit-breaker — Python v0.1

Native, dependency-free Python implementation of the Sovereign Circuit Breaker contract.

## API

- `CircuitBreaker`
- `CircuitBreakerError`
- `FakeClock`

The breaker exposes `CLOSED`, `OPEN`, and `HALF_OPEN` states; configurable failure/success thresholds; deterministic cooldowns; bounded half-open probes; manual reset and lifecycle close; immutable statistics snapshots; and explicit cancellation errors.

Runtime dependencies: Python standard library only.

## Safety

Retryable failures open the circuit according to the configured threshold. Non-retryable failures are surfaced and counted without opening the circuit. Half-open probes are bounded to prevent uncontrolled concurrent recovery traffic.

## Development

```bash
python -m pytest tests -q
```

Requires Python 3.9+.
