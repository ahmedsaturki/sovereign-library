# Storage Persistence / Snapshot Cube v0.1 — Specification

## Objective

Provide a standalone, deterministic local persistence/snapshot component for Sovereign-compatible data without runtime third-party dependencies.

## Product contract

The cube must expose versioned snapshot creation, atomic filesystem save/load, integrity verification, immutable loaded snapshots, and deterministic failure/recovery behavior.

## Data model

A snapshot contains:
- format identifier
- format version
- creation metadata limited to deterministic caller-supplied values
- bounded payload
- checksum/integrity field

Payloads are limited to JSON-safe Sovereign-compatible values already supported by repository serialization/canonicalization contracts. Unsupported values, accessors, circular structures, and excessive nesting/work fail closed.

## Encoding

The envelope and payload representation must be deterministic. Equivalent supported input values must produce identical serialized bytes. No environment-specific path, locale, timezone, random identifier, or wall-clock metadata may enter the canonical payload unless explicitly supplied by the caller.

## Integrity

The loader must verify the checksum before exposing payload data. Corrupted, truncated, malformed, version-incompatible, and checksum-mismatched snapshots must produce typed errors and must not partially mutate any destination state.

## Persistence lifecycle

Save:
1. validate and encode the snapshot
2. write to a uniquely named temporary file in the target directory
3. flush/close the temporary file
4. atomically rename into place
5. best-effort cleanup of failed temporary files

Load:
1. read bounded bytes
2. validate envelope/version
3. verify integrity
4. decode payload
5. expose an immutable snapshot

## Crash/recovery contract

A failed or interrupted save must not replace an already valid target snapshot. Loading a truncated temporary file must never treat it as the authoritative snapshot. A failed recovery/cleanup must surface a bounded typed diagnostic without copying arbitrary filesystem payloads.

## Bounds

The implementation must enforce finite limits for:
- total serialized bytes
- payload bytes
- nesting depth
- object/array entries
- path length
- checksum/metadata lengths

Validation must occur before unbounded allocation where practical.

## Immutability

Caller-owned input must remain untouched. Returned snapshots, metadata, and diagnostics must be immutable snapshots.

## Failure semantics

Typed fail-closed errors must distinguish invalid input, invalid path, unsupported format/version, malformed snapshot, integrity failure, size limit, I/O failure, and recovery/cleanup failure where the underlying cause is safely knowable.

Errors must not include arbitrary payload copies. Paths and diagnostics are bounded.

## Cross-platform

Target verification matrix: Ubuntu, Windows, macOS-15-Intel. Filesystem behavior must use portable standard APIs only.

## Dependency policy

Zero runtime third-party dependencies.

## Required tests

- deterministic encoding
- save/load round trip
- equivalent input produces identical bytes
- checksum mismatch
- truncation/corruption
- unsupported version
- oversized payload
- path/boundary validation
- atomic replacement preserves prior snapshot on failed save
- failed cleanup does not corrupt the prior state
- immutable loaded snapshot
- source immutability
- restart/recovery behavior
- cross-platform repository verification
- real-browser repository smoke gate

## Definition of done

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Release requires full repository CI on Ubuntu, Windows, and macOS-15-Intel plus public documentation and a runnable example.
