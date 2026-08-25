# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Serialization / Binary Codec v0.1

Release-gate Run 308 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `4e4ebf0bd503e72ec27d1984237b41ad47a56adb`.

The release defines the owned `SLBC` v1 binary format with explicit type tags, deterministic object key ordering, bounded payload/depth/collection/string sizes, duplicate-key rejection, and no executable decoding.

### Digest / Hash v0.1

Release-gate Run 301 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `0500948a6a7c62492ca50ed2d93777baf7604809`.

The release provides SHA-256/SHA-512, HMAC-SHA256/HMAC-SHA512, bounded AsyncIterable hashing, constant-time same-length byte comparison, immutable config, and typed crypto errors using Node.js `node:crypto` only.

### Stream / Pipeline v0.1

Release-gate Run 294 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `9ac578f0ebee01dc2825672a096daf3a4539ffe7`.

The release provides lazy AsyncIterable pipelines, ordered transforms, bounded chunk sizing, pull-based backpressure, cancellation propagation, typed source/transform/sink failures, and cleanup hooks without runtime third-party dependencies.

### Content-Encoding / Compression v0.1

Release-gate Run 290 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `ec31bec3c41804ec34d4ee961ef1b745aa306d61`.

The release uses Node.js `node:zlib` runtime primitives only and adds bounded input/output contracts, typed errors, and sync/async gzip/deflate helpers with no runtime third-party dependencies.

### URL / Query / Encoding v0.1

Release-gate Run 281 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The release was squash-merged as `0e4f629d60e5c4566d2194ec6744c13ee57a7526`.

The release fixed a real Base64 defect: UTF-8 `Uint8Array` values must be converted through `Buffer.from(bytes)` before Base64 encoding.

## Active milestone

### Worker Pool / Parallel Execution Cube v0.1

Target: a native bounded worker-thread execution primitive reusable by CPU-heavy tasks, compression, serialization, data processing, and future agent runtimes.

Initial scope:
- fixed-size or bounded worker pool
- explicit task submission contract
- bounded queued tasks
- FIFO task admission
- worker lifecycle and replacement
- task timeout
- task cancellation before execution
- deterministic task result/error envelopes
- graceful drain and shutdown
- no shared mutable state across workers
- local unit/integration/failure/recovery tests
- cross-platform verification

Out of scope until v0.2+:
- distributed workers
- remote execution
- job brokers
- persistent task queues
- shared-memory protocols
- arbitrary module loading from untrusted input
- third-party worker-pool packages
- cluster orchestration

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
