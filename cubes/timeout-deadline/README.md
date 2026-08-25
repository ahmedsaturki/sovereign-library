# Timeout / Deadline Cube v0.1

Standalone native timeout/deadline primitive.

## Contract

- deadlines are based on a monotonic clock
- remaining time is deterministic through an injected clock
- child deadlines may only shorten a parent deadline
- `withDeadline()` races completion against the deadline and propagates cancellation through `AbortSignal`
- timeout errors carry explicit deadline metadata
- no runtime third-party dependencies
