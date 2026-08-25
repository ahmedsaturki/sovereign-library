# Policy / Capability Security Cube v0.1

## Purpose

Provide a standalone local policy evaluator for bounded capability authorization decisions. The cube is deterministic, immutable, fail-closed, auditable, and dependency-free.

## Contract

Policy rules contain:
- `id`: non-empty stable rule identifier
- `effect`: `allow` or `deny`
- `action`: exact or hierarchical segment pattern
- `resource`: exact or hierarchical segment pattern
- optional `priority`: positive/negative safe integer
- optional `when`: bounded flat context predicates using exact scalar equality

Evaluation returns an immutable decision record with `allowed`, matched rule ids, winning rule id, and safe reason metadata.

## Matching

Patterns use slash-separated hierarchy. `*` matches exactly one segment; `**` matches zero or more segments. A literal segment is more specific than `*`, which is more specific than `**`.

A rule matches only when both action and resource patterns match and all `when` predicates equal the supplied context values.

## Precedence

1. higher `priority` wins
2. if tied, higher combined action/resource specificity wins
3. if still tied, `deny` wins
4. if still tied, lexicographically smaller rule id wins

No implicit ambient identity or environment data is consulted.

## Bounds / safety

The implementation bounds rule count, pattern length, context key/value size, predicate count, and diagnostic size. Accessors, circular structures, unsupported values, malformed patterns, duplicate rule ids, and invalid effects fail closed before evaluation.

## Definition of done

- standalone implementation + README + example
- deterministic matching and precedence tests
- malformed/accessor/circular input tests
- bounds/recovery tests
- immutable decision/audit snapshots
- zero runtime third-party dependencies
- Ubuntu/Windows/macOS CI and repository browser smoke
