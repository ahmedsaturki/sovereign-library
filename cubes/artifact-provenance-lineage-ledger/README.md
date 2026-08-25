# Artifact Provenance / Lineage Ledger v0.1

Standalone deterministic local provenance ledger with explicit artifact lineage, bounded traversal, immutable snapshots, and checksum-protected serialization.

## Guarantees

- append-only event history
- deterministic event sequence and ordering
- explicit parent/derived relationships
- bounded ancestry/descendant traversal
- metadata validation and accessor rejection
- atomic state growth: rejected appends do not mutate valid state
- deterministic serialization with SHA-256 integrity check
- zero runtime third-party dependencies

## Example

```js
import { createProvenanceLedger } from './src/index.js';

const ledger = createProvenanceLedger();
ledger.append({
  eventId: 'build-1',
  actor: 'builder',
  action: 'build',
  source: 'ci',
  parents: ['source'],
  derivedArtifact: 'binary',
  metadata: { target: 'linux-x64' }
});

console.log(ledger.ancestors('binary'));
console.log(ledger.serialize());
```

No registry, network service, filesystem scan, or external SDK is consulted by the core cube.
