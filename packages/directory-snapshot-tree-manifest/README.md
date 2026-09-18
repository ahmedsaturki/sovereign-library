# Directory Snapshot / Tree Manifest v0.1

Standalone read-only local directory inventory. It produces a deterministic immutable manifest for a directory tree, with explicit file/directory/symlink entries, bounded traversal, optional file digests, and explicit concurrent-mutation/error policies.

## API

```js
import { snapshotDirectory, serializeDirectorySnapshot } from './src/index.js';

const snapshot = await snapshotDirectory('/work', {
  symlinkPolicy: 'record-only',
  mutationPolicy: 'record-warning',
});

console.log(snapshot.snapshotId);
console.log(serializeDirectorySnapshot(snapshot));
```

## Symlinks

Default `record-only` never follows symlink targets. `reject` fails on the first symlink. `follow-contained` only follows targets that resolve inside the canonical root.

## Mutation model

The snapshot is a best-effort capture, not a filesystem transaction. `fail-fast`, `record-warning`, and `skip-vanished` let callers choose how vanished or inaccessible entries are handled.

## Digesting

Digesting is opt-in through an injected capability. The cube verifies size/mtime stability around the read and fails on a detected concurrent change.

## Bounds

Depth, entry count, path length, warnings, manifest bytes, and file-digest bytes are all bounded by hard ceilings.

## Side effects

The cube never writes into the scanned tree and has no runtime third-party dependencies.
