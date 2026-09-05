# Local Artifact Catalog / Package Index v0.1

Standalone deterministic local catalog for artifact/package records and bounded exact, prefix, tag, and version queries.

## Example

```js
import { ArtifactCatalog } from './src/index.js';

const catalog = await new ArtifactCatalog({ file: './catalog.sac' }).open();
await catalog.add({
  identifier: 'example:demo:1.0.0',
  packageName: 'demo',
  version: '1.0.0',
  digest: 'a'.repeat(64),
  tags: ['stable'],
  metadata: { channel: 'stable' },
});

console.log(catalog.query({ packageName: 'demo' }));
```

## Contract

Catalog state is serialized with the versioned `SAC1` format and protected by a SHA-256 checksum over the canonical payload. Records are sorted by stable identifier and normalized metadata keys are deterministic.

Mutations persist through an atomic temporary-file replacement when a persistence file is configured. Reads and snapshots are immutable public values.

Runtime dependencies: none.
