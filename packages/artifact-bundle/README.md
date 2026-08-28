# Artifact Bundle / Reproducible Package v0.1

Standalone deterministic local bundle generation, verification, and safe extraction using native Node.js primitives only.

## Example

```js
import { createBundle, verifyBundle, extractBundle } from './src/index.js';

const bundle = createBundle([
  { path: 'hello.txt', bytes: new TextEncoder().encode('hello') }
], { metadata: { version: 1 } });

console.log(verifyBundle(bundle.bytes));
await extractBundle(bundle.bytes, './out');
```

## Contract

The format uses a stable `SAB1` header and canonical JSON payload. Entries are normalized to relative POSIX-style paths, ordered deterministically, bounded, and described by exact size and SHA-256 digests. Extraction never invokes embedded commands.

Runtime dependencies: none.
