# Canonical JSON / Normalization Cube v0.1

## Status

SPEC — contract frozen before implementation.

## Product goal

Provide a standalone deterministic canonicalization engine for JSON-safe values. The same supported value must produce the same normalized structure and canonical serialized JSON regardless of input object key insertion order.

## Supported value domain

The accepted domain is:

- `null`
- booleans
- finite JavaScript numbers
- strings
- arrays containing supported values
- plain objects containing supported values

Accessor properties, class instances, `Date`, `Map`, `Set`, functions, symbols, `BigInt`, `Infinity`, `-Infinity`, and `NaN` are rejected.

Circular references are rejected before recursive descent can continue indefinitely.

## Object ordering

Plain-object own enumerable string keys are sorted deterministically by UTF-16 code-unit ordering before normalization and serialization. Prototype inheritance is never traversed.

Objects with a null prototype are supported. Accessor descriptors are rejected; only data-property values are accepted.

## Number semantics

Only finite numbers are accepted.

`-0` is preserved as a distinct numeric value in the normalized structure and canonical JSON representation. Canonical serialization must not silently collapse `-0` into `0`.

No locale-sensitive number formatting is permitted. Serialization uses deterministic ECMAScript-compatible numeric formatting with no implementation-defined whitespace.

## Canonical JSON serialization

Canonical output contains no insignificant whitespace.

Object members are emitted in deterministic sorted-key order.

Arrays preserve element order.

Strings are serialized using JSON escaping.

Only the supported JSON-safe domain is serializable.

## Immutability

The normalizer must never mutate caller-owned input.

Returned normalized objects and arrays are deeply immutable.

Configuration and public result snapshots are immutable.

## Bounds

The implementation must enforce finite positive safe-integer limits for:

- maximum traversal depth
- maximum node count
- maximum UTF-8 string bytes
- maximum serialized output bytes

Limits are checked before unbounded work and must fail with typed errors.

## Diagnostics

Errors use a stable typed error class and bounded metadata:

- machine-readable error code
- safe path where applicable
- HTTP-style status where meaningful

Diagnostics must never copy arbitrary caller payload values into error messages or metadata.

## Public API target

The v0.1 implementation should expose:

- `createCanonicalizer(options)` returning immutable configuration plus `normalize(value)` and `stringify(value)` operations
- convenience `normalize(value, options)`
- convenience `canonicalStringify(value, options)`
- exported defaults
- exported typed error class

## Determinism requirements

For identical supported semantic input, normalized output and canonical string are byte-for-byte deterministic.

Two plain objects with the same keys and values inserted in different orders must canonicalize identically.

Equivalent nested structures must remain equivalent after normalization.

## Failure and recovery requirements

The implementation must fail closed on malformed or unsupported input and recover cleanly for subsequent valid calls on the same canonicalizer instance.

A rejected operation must not partially mutate configuration or caller input.

## Dependency contract

Zero runtime third-party dependencies. Node.js standard-library primitives are allowed.

## Definition of done

- implementation exists and is standalone
- README and example are present
- unit, contract, integration, failure, and recovery tests pass
- deterministic ordering and number semantics are covered by regression tests
- circular and unsupported inputs fail before unsafe recursion
- source and returned values are immutable
- bounds are enforced deterministically
- supported GitHub CI matrix passes on Ubuntu, Windows, and macOS-15-Intel
- real-browser smoke gate remains green
- ROADMAP and PROJECT_CONTROL are updated before release
