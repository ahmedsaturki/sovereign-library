# Result / Error Cube v0.1

Standalone success/failure values and typed error primitives for Sovereign Library.

## Guarantees

- Native Node.js / ECMAScript only.
- Immutable result records and error metadata.
- Explicit success/failure branching.
- Throwable and Promise rejection normalization.
- Typed codes for cancellation, timeout, validation and retryable failures.
- Cause chaining and serialization-safe diagnostics.
- `map`, `mapErr`, `andThen`, `recover`, `match`, `ensure`, `unwrap`, and `unwrapOr`.

## Scope exclusions

This cube does not implement logging, retries, scheduling, tracing, remote transport, or persistence.
