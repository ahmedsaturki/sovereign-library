# Artifact Release Closure Receipt v0.1

Standalone deterministic receipt linking one frozen release snapshot to one approved decision record.

## Contract

`buildReleaseClosure(snapshot, approval, options)` verifies exact snapshot/approval identity and checksum linkage, requires `approval.status === "approved"`, normalizes bounded closure metadata and evidence references, and returns an immutable closure receipt.

The cube is a handoff record only. It does not publish, deploy, mutate, discover, sign, or call external services.

## Integrity

`serializeReleaseClosure()` emits an `SRC1` SHA-256-protected JSON envelope. `parseReleaseClosure()` verifies the checksum before exposing the frozen receipt.

## Failure behavior

Mismatched links, non-approved decisions, malformed ids/checksums, duplicate/invalid data, accessors, circular metadata, oversized inputs, and corrupted serialized envelopes fail closed with typed `ReleaseClosureError` failures.
