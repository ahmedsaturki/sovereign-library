# Artifact Release Publication Confirmation / Outcome Receipt v0.1

Deterministic immutable handoff record for one explicit publication outcome.

## API

- `buildPublicationConfirmation({ closureReceipt, outcomeSnapshot, plan })`
- `serializePublicationConfirmation(receipt)`
- `parsePublicationConfirmation(serialized)`

## Rules

The cube validates exact closure and plan/outcome linkage. It never executes publication, fetches evidence, resolves destinations, invents timestamps, or calls external services.

Evidence and timestamps are caller-supplied and bounded. Serialization uses checksum-protected `SPC1` envelopes.
