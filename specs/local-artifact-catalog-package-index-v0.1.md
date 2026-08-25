# Local Artifact Catalog / Package Index v0.1

## Goal

Provide a standalone deterministic local catalog for registering artifact/package records, querying them exactly and by prefix/tag/version, persisting the catalog safely, and restoring it deterministically.

## Public contract

### Artifact record

- stable artifact identifier
- package name
- package version as an opaque deterministic string
- content digest
- optional bounded tags and metadata
- timestamps are excluded from canonical serialization unless explicitly supplied as logical data

### Mutations

- add is atomic and rejects conflicting duplicate identifiers
- update is atomic and rejects identity-changing writes
- remove is atomic and idempotent where the record is absent
- failed mutations leave the previous valid snapshot intact

### Queries

- exact identifier lookup
- exact package/version lookup
- deterministic prefix lookup
- deterministic tag lookup
- bounded result count
- stable ordering independent of insertion order

### Persistence

- versioned deterministic serialized catalog
- checksum over canonical payload
- corruption, truncation, unsupported version, duplicate record, and malformed state fail closed
- immutable loaded/public snapshots

## Limits

- maximum record count
- maximum identifier length
- maximum package/version/tag/metadata lengths
- maximum result count
- maximum serialized catalog size

## Dependencies

Zero runtime third-party dependencies. Native Node.js standard-library primitives only.

## Out of scope

- remote registries
- package publishing
- network transport
- remote dependency resolution
- signing/key management
- GUI/admin console
- full semantic-version solver
- background synchronization

## Definition of done

1. SPEC committed
2. implementation complete
3. unit/contract/failure/recovery tests complete
4. cross-platform GitHub Actions pass on Ubuntu, Windows, and macOS-15-Intel
5. real-browser smoke gate passes
6. README, changelog, and runnable example are present
7. release merge is followed by clean `main` post-merge verification
8. control, roadmap, and README record release and freeze
