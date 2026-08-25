# Diff / Patch Cube v0.1

## Product contract

A standalone native structural diff and patch engine for JSON-safe values. The cube has zero runtime third-party dependencies and never mutates caller-owned input.

## Supported values

- `null`
- booleans
- finite numbers, including `-0`
- strings
- arrays containing supported values
- plain objects with string keys

Unsupported values, non-finite numbers, non-plain objects, accessors, and circular references fail closed.

## Diff

`diff(before, after)` returns an immutable, deterministic array of operations:

- `{ op: "add", path, value }`
- `{ op: "remove", path }`
- `{ op: "replace", path, value }`

Paths use strict RFC 6901 JSON Pointer escaping (`~0`, `~1`). The root path is the empty string. Object keys are processed lexically. Array changes are compared by index; trailing removals are emitted from highest index to lowest index and additions from lowest index to highest index.

## Patch

`applyPatch(source, operations)` validates the complete operation list before mutation and applies it to a private clone. The caller's source and operation objects are never mutated. Operations are deterministic and strict:

- `add` requires an absent object member or an array index in `[0, length]`.
- `replace` requires an existing member/index.
- `remove` requires an existing member/index.
- root `replace` is allowed; root `add` and `remove` are rejected.
- duplicate exact paths in one patch are rejected.
- malformed pointers, unknown operation members, unsafe values, and limit violations are rejected.

## Bounds

The configuration must use finite safe positive integers for:

- maximum traversal depth
- maximum visited nodes
- maximum operations
- maximum UTF-8 string bytes
- maximum serialized value bytes

All limits are checked before unbounded work where practical and again on generated/applied output.

## Errors and diagnostics

`DiffPatchError` exposes a stable `code`, optional `path`, and optional `operationIndex`. Error messages contain structural metadata only and never interpolate arbitrary caller values.

## Definition of done

- public API and example documented
- zero runtime third-party dependencies
- deterministic diff and patch behavior
- immutable results
- input immutability
- bounds and malformed-input rejection
- unit, contract, failure, and recovery tests
- cross-platform CI and existing browser smoke gate pass
