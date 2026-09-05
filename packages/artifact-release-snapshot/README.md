# Artifact Release Snapshot / Candidate Set v0.1

Standalone deterministic snapshot builder for an explicit release candidate set.

## Contract

`buildReleaseSnapshot(candidates, config)` validates and normalizes candidate identity, semantic version, SHA-256 digest, admission verdict, and bounded evidence references. The result is immutable and ordered by stable candidate identity rather than caller insertion order.

The cube performs no discovery, publication, deployment, mutation, signing, or scheduling.

## Example

```js
import { buildReleaseSnapshot } from './src/index.js';

const snapshot = buildReleaseSnapshot([
  {
    id: 'app',
    version: '1.2.0',
    digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    admissionVerdict: 'eligible',
    evidenceRefs: ['digest:app'],
  },
]);

console.log(snapshot.verdict); // release_ready
```

## Integrity

`serializeReleaseSnapshot()` emits an `SCS1` SHA-256 protected JSON envelope. `parseReleaseSnapshot()` verifies integrity before returning the frozen snapshot.

## Failure behavior

Invalid ids, semantic versions, SHA-256 digests, admission verdicts, duplicate candidate identities, accessor/circular input, oversized evidence, and invalid limits fail closed with typed `ReleaseSnapshotError` instances.
