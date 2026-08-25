# Content-Addressed Storage / CAS v0.1

## Contract

A standalone local content-addressed object store maps content bytes to a deterministic native digest address and persists immutable objects under bounded local storage rules.

### Required properties

- deterministic digest-based address derived from exact bytes
- get/put/has/delete semantics with immutable stored content
- atomic writes with collision-safe existing-object handling
- corruption detection on read
- deterministic address normalization and validation
- bounded object size/count, address length, and metadata size
- safe namespace isolation and path traversal rejection
- immutable metadata snapshots
- typed fail-closed errors
- recovery after rejected writes/corrupt records
- zero runtime third-party dependencies

## Out of scope

- network or remote replication
- distributed consensus
- encryption or key management
- HTTP transport
- GUI/admin console
- package registry/publishing

## Definition of done

SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE with Linux, Windows, and macOS verification plus real-browser smoke.
