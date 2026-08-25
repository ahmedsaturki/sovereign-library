# Artifact Dependency Graph / Relationship Index v0.1

## Goal

Provide a standalone deterministic local directed relationship graph for artifact/package nodes and typed edges, supporting bounded adjacency and path queries, cycle detection, atomic mutations, and deterministic backup/restore.

## Public contract

### Nodes

- stable node identifier
- bounded type/label
- optional bounded canonical metadata

### Edges

- stable edge identifier derived from source, target, and relationship type
- directed relationship type
- duplicate/conflicting edge rejection

### Queries

- exact outgoing neighbors
- exact incoming neighbors
- bounded path existence / path enumeration
- deterministic adjacency ordering
- bounded result count

### Mutations

- add node
- remove node and its incident edges atomically
- add edge after validating node existence
- remove edge idempotently
- mutation failures preserve previous valid graph state

### Persistence

- versioned deterministic serialization
- checksum over canonical payload
- restore rejects malformed/truncated/corrupt state
- snapshots are immutable and independent of mutable source inputs

## Safety limits

- maximum nodes
- maximum edges
- maximum identifier/type/label lengths
- maximum metadata size
- maximum path depth
- maximum query results
- maximum serialized graph size

## Determinism

Node and edge ordering, generated edge identifiers, serialization, snapshots, and query results must be independent of insertion order.

## Dependencies

Zero runtime third-party dependencies. Native Node.js standard-library primitives only.

## Out of scope

- remote graph synchronization
- remote dependency resolution
- semantic-version solving
- package publishing
- network transport
- GUI/admin console
- graph visualization UI
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
