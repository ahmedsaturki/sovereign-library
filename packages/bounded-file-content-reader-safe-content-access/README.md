# Bounded File Content Reader / Safe Content Access v0.1

Standalone bounded binary/text file access with explicit offsets, EOF behavior, UTF-8 decoding, symlink policy, cancellation, deadlines, cleanup, and backpressure.

## Collected read

```js
import { readFileContent } from './src/index.js';

const result = await readFileContent('/workspace/file.txt', {
  mode: 'text',
  maxBytes: 1_000_000,
  newline: 'lf',
});
console.log(result.text);
```

## Chunked read

```js
import { readFileChunks } from './src/index.js';

for await (const chunk of readFileChunks('/workspace/file.bin', {
  mode: 'binary',
  chunkSize: 64 * 1024,
})) {
  consume(chunk.data);
}
```

## Safety contract

- binary mode returns exact bytes
- text mode is strict UTF-8 only
- no automatic encoding detection
- `offset`/`length` are byte-based and safe-integer bounded
- `length: 0` performs no file open
- default symlink policy is `reject`
- `follow-contained` uses Safe Path Resolver containment
- relative paths require an explicit root
- collected and streaming modes are bounded by byte/chunk/work limits
- cancellation and deadline always close owned handles
- diagnostics never copy arbitrary file contents
- runtime dependencies: zero third-party packages

See the repository SPEC for the complete v0.1 contract.
