# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Stream / Pipeline v0.1

Release-gate Run 294 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `9ac578f0ebee01dc2825672a096daf3a4539ffe7`.

The release provides lazy AsyncIterable pipelines, ordered transforms, bounded chunk sizing, pull-based backpressure, cancellation propagation, typed source/transform/sink failures, and cleanup hooks without runtime third-party dependencies.

### Content-Encoding / Compression v0.1

Release-gate Run 290 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `ec31bec3c41804ec34d4ee961ef1b745aa306d61`.

The release uses Node.js `node:zlib` runtime primitives only and adds bounded input/output contracts, typed errors, and sync/async gzip/deflate helpers with no runtime third-party dependencies.

### URL / Query / Encoding v0.1

Release-gate Run 281 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `0e4f629d60e5c4566d2194ec6744c13ee57a7526`.

The release also fixed a real Base64 defect: UTF-8 `Uint8Array` values must be converted through `Buffer.from(bytes)` before Base64 encoding; calling `Uint8Array.toString('base64')` does not perform Base64 encoding.

## Active milestone

### Digest / Hash Cube v0.1

Target: a standalone native integrity primitive reusable by HTTP metadata, ETag handling, storage, content addressing, caching, and future authentication layers without third-party crypto packages.

Initial scope:
- SHA-256
- SHA-512
- HMAC-SHA256
- HMAC-SHA512
- hex and byte digest outputs
- bounded synchronous input sizes
- bounded AsyncIterable hashing
- constant-time same-length byte comparison
- deterministic typed crypto errors
- immutable configuration snapshots
- local unit/integration/failure/recovery tests
- cross-platform verification

Out of scope until v0.2+:
- password hashing / KDFs
- public-key cryptography
- signatures
- key generation
- encryption/decryption
- authentication protocols
- certificate handling
- third-party crypto packages

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
