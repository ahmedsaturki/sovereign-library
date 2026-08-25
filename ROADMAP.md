# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Metrics / Telemetry v0.1

Release-gate Run 329 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `3c6f171f0469b34a055008b9594d043acb680f6c`.

The release provides bounded counters, gauges, deterministic cumulative histograms, metric and label validation, cardinality limits, immutable snapshots, deterministic JSON export, safe operational recording, and high-resolution timing using native Node timing primitives only.

### Worker Pool / Parallel Execution v0.1

Release-gate Run 322 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `073ab5b9a27f03d7441bec8549786cd8e8f28f57`.

The release uses Node.js `node:worker_threads` only and provides bounded concurrency, FIFO admission, structured-clone task boundaries, active/queued cancellation, task timeouts, worker crash recovery, trusted worker-module loading, immutable stats, and deterministic drain/close lifecycle behavior.

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

### Redaction / Secret Safety Cube v0.1

Target: a standalone recursive data-redaction and secret-safety product for logs, diagnostics, configuration snapshots, HTTP payloads, and structured error reporting without third-party runtime dependencies.

Initial scope:
- deterministic sensitive-key matching
- configurable custom redaction rules
- string secret-pattern redaction
- recursive plain-object/array traversal
- bounded depth, node count, input/output string size
- circular-reference detection
- no input mutation
- immutable/redaction-safe output
- deterministic replacement policy
- path-aware diagnostics without exposing secret values
- local unit/integration/failure/recovery tests
- cross-platform verification

Out of scope until v0.2+:
- secret storage or key management
- encryption/decryption
- credential rotation
- network policy enforcement
- external DLP services
- third-party redaction packages

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
