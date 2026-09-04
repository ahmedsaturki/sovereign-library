# Validation / Schema Cube v0.1

Standalone runtime validation primitives with no third-party runtime dependencies.

## Guarantees

- Immutable reusable schema definitions.
- Deterministic issue objects with path/code/message.
- Primitive, object, and array validation.
- Required/optional fields, defaults, enums, literals, and bounds.
- Unknown-key policies: preserve, strip, or error.
- Custom validators.
- Explicit opt-in coercion only.
- `safeParse()` for structured results and `parse()` for typed `ValidationError`.

## Non-goals

This v0.1 release is not a full JSON Schema or OpenAPI implementation and does not generate code, forms, or remote schema artifacts.
