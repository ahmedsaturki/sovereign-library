# Artifact Provenance / Lineage Ledger v0.1

## Product goal

A standalone deterministic local ledger for recording artifact provenance events and explicit lineage relationships without requiring a network service, registry, filesystem discovery, or third-party runtime dependency.

## Public contract

- Artifact identity is explicit and stable.
- Event identity is explicit and unique within the ledger.
- Events are append-only and ordered by deterministic sequence.
- An event may declare zero or more parent artifact identities and one derived artifact identity.
- Actor/action/source metadata is bounded, validated, and fail-closed.
- Reads return immutable snapshots.
- Ancestry and descendant traversal is deterministic and bounded by depth/result limits.
- Invalid lineage references, duplicate event IDs, malformed metadata, accessors, circular inputs, and oversized payloads fail closed without partial writes.
- Persistence uses deterministic canonical serialization and a checksum-protected wire format.
- Failed append/persist operations cannot poison the previously valid state.

## Scope

Included: local event append, explicit lineage relationships, deterministic ordering, bounded traversal, snapshot reads, checksum-protected persistence, corruption detection, typed errors, unit/contract/failure/recovery tests, examples, documentation.

Excluded: remote stores, network transport, distributed consensus/locks, signatures/certificates, automatic discovery, trust-policy engines, GUI/admin console, scheduler integration, billing.

## Definition of done

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A release requires syntax validation, full repository tests, browser smoke, normal-path tests, failure/recovery coverage, documentation, runnable example, clean deterministic serialization, and successful verification on Ubuntu, Windows, and macOS-15-Intel.
