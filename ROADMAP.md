# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

All previously released cubes remain frozen on `main`, including URL / Query / Encoding v0.1.

### URL / Query / Encoding v0.1

Release-gate Run 281 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `0e4f629d60e5c4566d2194ec6744c13ee57a7526`.

The release also fixed a real Base64 defect: UTF-8 `Uint8Array` values must be converted through `Buffer.from(bytes)` before Base64 encoding; calling `Uint8Array.toString('base64')` does not perform Base64 encoding.

## Active milestone

### Content-Encoding / Compression Cube v0.1

Target: a standalone native compression/decompression primitive reusable by HTTP, storage, data, and automation cubes without third-party compression frameworks.

Initial scope:
- gzip compression/decompression
- deflate/inflate compression/decompression
- bounded input/output size limits
- deterministic typed compression/decompression errors
- immutable configuration snapshots
- buffer-safe native primitives
- local unit/integration/failure/recovery tests
- cross-platform verification

Out of scope until v0.2+:
- ZIP archives
- TAR archives
- password encryption
- distributed compression workers
- third-party compression packages
- HTTP policy/negotiation logic

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
