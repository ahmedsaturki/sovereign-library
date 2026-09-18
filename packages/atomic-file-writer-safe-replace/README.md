# Atomic File Writer / Safe Replace v0.1

Standalone dependency-free primitive for replacing one local file with a fully written candidate without copy-then-delete fallback.

## API

```js
import { writeFileAtomic } from './src/index.js';

const result = await writeFileAtomic('/tmp/config.json', '{"version":1}', {
  digest: 'sha256:<expected digest>',
  modePolicy: 'preserve-existing',
});
```

A streaming writer is also supported:

```js
await writeFileAtomic('/tmp/output.bin', async (writer) => {
  await writer.write(chunkA);
  await writer.write(chunkB);
});
```

## Guarantees

The candidate file is created in the destination directory, written completely, optionally digest-verified, optionally permission-adjusted, and then replaced with a native same-filesystem rename operation. The cube never falls back to copy-then-delete.

The atomic replacement guarantee is distinct from crash durability. `durability: 'file'` and `durability: 'file-and-directory'` are explicit requests and use standard-library file-descriptor synchronization where supported by the host platform. They do not make a universal cross-filesystem durability promise.

## Safety boundary

Destination symlinks are rejected by default. Candidate files are generated inside the destination directory from a bounded non-clock-only identity value. Cleanup only removes a candidate while ownership of that exact path is known.

Existing destination content is left untouched when candidate writing or digest validation fails.

## Limits

The non-streaming and streaming APIs are bounded at 16 MiB by default. Metadata and destination path lengths are also bounded. Unsupported values, accessors, circular structures, and invalid capability seams fail closed with immutable `AtomicFileWriterError` codes.

## Platform behavior

The cube targets Ubuntu, Windows, macOS-15-Intel, and relevant WSL filesystem boundaries. Native filesystem semantics differ across platforms; the implementation deliberately avoids claiming distributed locking, universal durability, or cross-device atomic replacement.

## Side-effect boundary

No network, process execution, advisory locking, file watching, database, cloud service, or third-party runtime dependency is required.
