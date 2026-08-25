# Reporting / Export Cube v0.1 — Specification

## Objective

Provide a standalone deterministic local reporting/export component for in-process data without runtime third-party dependencies.

## Product contract

The cube accepts bounded row-like records plus an explicit report definition and produces an immutable report snapshot or deterministic JSON/CSV output.

## Report model

A report consists of:
- stable report identifier/version
- explicit columns
- optional filters
- optional grouping keys
- optional aggregations
- explicit ordering
- bounded pagination/output rules

Definitions must be validated before execution. Accessor-bearing definitions fail closed without evaluating getters.

## Determinism

Equivalent input and definition must produce identical snapshots and serialized output. Ordering must never depend on object insertion order, locale, timezone, process identity, or filesystem behavior.

Default sorting is explicit and stable. Ties use declared keys followed by deterministic source sequence where permitted by the contract.

## Aggregation

v0.1 supports bounded built-in aggregations only: count, sum, min, max, and average over validated numeric values. Null/missing-value semantics are explicit and deterministic.

## Export

JSON:
- stable top-level envelope
- deterministic key ordering
- explicit null representation
- bounded output bytes

CSV:
- UTF-8 text
- explicit delimiter/quote/newline behavior
- RFC 4180-compatible quoting semantics where applicable
- deterministic column order
- explicit null representation
- bounded output bytes

## Streaming

Large reports must support bounded async streaming without requiring the entire final output in memory. Cancellation must stop further production and close owned resources. Partial output must never be mislabeled as a complete report.

## Bounds

Enforce finite limits for:
- row count
- column count
- group count
- cell/string bytes
- nesting depth where values are accepted
- aggregation work
- page size
- output bytes
- buffered stream chunks

## Immutability

Source records and definitions are never mutated. Snapshots, report metadata, results, and errors are immutable.

## Failure/recovery

Typed fail-closed errors distinguish invalid definitions, unsupported values, bounds, cancellation, and output failures. Failed export must not return a success marker for partial output. A subsequent valid export must be able to recover normally.

## Dependency policy

Zero runtime third-party dependencies.

## Required tests

- deterministic report snapshots
- stable filtering/sorting/grouping
- built-in aggregations
- pagination
- JSON export
- CSV escaping/newlines/quotes/nulls
- streaming output and chunk bounds
- cancellation and partial-output failure semantics
- accessor rejection without getter evaluation
- source/result immutability
- output/work limits
- recovery after a failed export
- cross-platform verification and repository browser smoke

## Definition of done

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Release requires full GitHub CI on Ubuntu, Windows, and macOS-15-Intel plus public documentation and a runnable example.
