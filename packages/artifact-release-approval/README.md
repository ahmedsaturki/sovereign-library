# Artifact Release Approval / Decision Record v0.1

Standalone deterministic approval record bound to one explicit frozen release snapshot and explicit reviewer decisions.

## Contract

`buildReleaseApproval(snapshot, scopes, decisions, config)` validates the snapshot identity, required/optional approval scopes, reviewer decisions, conflict rules, and evidence references. It computes `approved`, `rejected`, or `pending` deterministically and returns an immutable record.

This cube records decisions only. It does not contact external approval services and performs no publication or mutation.

## Example

```js
import { buildReleaseApproval } from './src/index.js';

const record = buildReleaseApproval(
  { snapshotId: 'release-1', snapshotChecksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  [{ id: 'security', required: true }, { id: 'ops', required: true }],
  [
    { id: 'sec-1', reviewerId: 'alice', scopeId: 'security', state: 'approve', evidenceRefs: ['ticket:1'] },
    { id: 'ops-1', reviewerId: 'bob', scopeId: 'ops', state: 'approve', evidenceRefs: ['ticket:2'] },
  ],
);

console.log(record.status); // approved
```

## Integrity

`serializeReleaseApproval()` emits an `SAD1` SHA-256-protected JSON envelope. `parseReleaseApproval()` verifies the checksum before returning the frozen record.

## Failure behavior

The cube rejects duplicate decision ids, duplicate reviewer/scope decisions, unknown scopes, invalid states, malformed snapshot identity/checksum, accessors, circular inputs, oversized evidence, and invalid limits with typed `ReleaseApprovalError` failures.
