# Artifact Release Publication Confirmation / Outcome Receipt v0.1

A standalone deterministic handoff cube that converts one explicit publication outcome snapshot into an immutable confirmation receipt for downstream audit and reconciliation.

## API

```js
buildPublicationConfirmation({
  closureReceipt,
  outcomeSnapshot,
  plan,
  metadata,
})

serializePublicationConfirmation(receipt)
parsePublicationConfirmation(serialized)
```

### Contract

- `closureReceipt` is the originating closed closure receipt.
- `outcomeSnapshot` must be a `publication_outcome` snapshot from the publication executor and must carry the **exact** closure identity: `receiptId`, `snapshotId`, `snapshotChecksum`, `approvalId`, and `approvalChecksum`.
- `plan` is an explicit list of planned intent identities. Each outcome must match its planned `intentId`, `idempotencyKey`, `destinationId`, `artifactId`, and `artifactDigest`.
- Only `succeeded`, `skipped_idempotent`, and `failed` are accepted states.
- `metadata` is optional, caller-supplied, finite, opaque plain-object metadata.
- Partial outcome snapshots are valid because a terminal executor failure can stop later intents from being attempted; missing outcomes are never inferred.

## Evidence and timestamps

Commit evidence and evidence references are opaque caller-supplied values. The cube never fetches, verifies, resolves, or invents evidence. Timestamps must be explicit ISO-8601 values and are normalized to UTC without consulting the system clock.

## Safety bounds

- maximum confirmation records: 256
- maximum evidence references per confirmation: 32
- maximum evidence-reference length: 512 characters
- maximum commit-evidence length: 4096 characters
- maximum metadata size: 8 KiB
- maximum serialized payload: 64 KiB
- maximum object nesting depth: 12

Malformed, accessor-backed, circular, unsupported, oversized, duplicate, and mismatched inputs fail closed with typed `PublicationConfirmationError` codes.

## Integrity

Serialization uses the versioned `SPC1` envelope with a SHA-256 checksum over the canonical payload. Parsing verifies the checksum before accepting the payload.

## Side-effect boundary

This cube performs no publication, network, filesystem, credential, destination discovery, scheduling, retry, signing, or external-service work. It owns confirmation construction and integrity-protected serialization only.

## Standalone status

Zero runtime third-party dependencies. The only runtime platform dependency is Node.js standard-library crypto. The cube is intended for Windows, Linux, macOS, and WSL where Node.js is supported.
