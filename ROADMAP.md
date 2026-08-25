# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

All previously released cubes remain frozen on `main`, including URL / Query / Encoding v0.1 and Content-Encoding / Compression v0.1.

### Content-Encoding / Compression v0.1

Release-gate Run 290 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `ec31bec3c41804ec34d4ee961ef1b745aa306d61`.

The release uses Node.js `node:zlib` runtime primitives only and adds bounded input/output contracts, typed errors, and sync/async gzip/deflate helpers with no runtime third-party dependencies.

### URL / Query / Encoding v0.1

Release-gate Run 281 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `0e4f629d60e5c4566d2194ec6744c13ee57a7526`.

The release also fixed a real Base64 defect: UTF-8 `Uint8Array` values must be converted through `Buffer.from(bytes)` before Base64 encoding; calling `Uint8Array.toString('base64')` does not perform Base64 encoding.

## Active milestone

### Stream / Pipeline Cube v0.1

Target: a standalone native bounded streaming/pipeline primitive reusable by HTTP, MIME, compression, storage, and process-oriented cubes without third-party stream frameworks.

Initial scope:
- AsyncIterable source/sink adapters
- ordered transform stages
- bounded buffering
- explicit backpressure
- cancellation propagation
- deterministic error propagation
- cleanup/finalization hooks
- simple tee/merge only if required by the core contract
- local unit/integration/failure/recovery tests
- cross-platform verification

Out of scope until v0.2+:
- distributed streaming
- message brokers
- reactive programming frameworks
- third-party stream libraries
- persistent queues
- workflow DAGs
- HTTP policy/negotiation
- archive formats

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
