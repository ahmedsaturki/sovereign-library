# Storage Persistence / Snapshot Cube v0.1

Standalone deterministic local snapshot persistence with versioned envelopes, integrity verification, atomic replacement, crash-safe temporary-file cleanup, immutable loaded snapshots, and zero runtime third-party dependencies.

## API

```js
import { createSnapshotStore } from './src/index.js';

const store = createSnapshotStore();
await store.save('./data/example.slib', { name: 'demo', count: 3 }, { schema: 'example' });
const snapshot = await store.load('./data/example.slib');
console.log(snapshot.payload);
```

The default format is `SLIBSNAP` version `1` with SHA-256 integrity. SHA-512 is available by explicit configuration.

## Guarantees

- deterministic canonical payload and metadata bytes
- checksum verification before payload exposure
- atomic replacement using a same-directory temporary file and rename
- bounded snapshot/payload/metadata/path/depth/entry work
- typed fail-closed diagnostics
- source immutability
- immutable returned snapshots
- corruption/truncation/version mismatch detection
- no network or database requirement

## Scope

Local filesystem persistence only. Encryption, replication, remote storage, databases, watchers, and network transport are intentionally out of scope for v0.1.
