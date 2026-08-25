# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Diff / Patch v0.1

Release-gate Run 345 completed the pre-merge verification and Run 347 completed the post-merge verification on `main`. Ubuntu, Windows, and macOS-15-Intel all passed syntax checks, the full repository suite, and the real-browser smoke gate. The cube was squash-merged through PR #48 as `e1acaeea3ec0b02da8998ac30a2f910e64aa2ade`.

The release provides deterministic structural diff generation and persistent immutable patch application for JSON-safe primitives, arrays, and plain objects, with strict JSON Pointer paths, bounded work and value sizes, source immutability, conflict rejection, circular-reference detection, typed fail-closed diagnostics, public documentation, runnable examples, and zero runtime third-party dependencies.

### Redaction / Secret Safety v0.1

Release-gate Run 341 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real-browser smoke test. The cube was squash-merged as `e1040a0464f10f6e20d2ed39b5dd2e9097edae83` through PR #45.

The release provides bounded recursive redaction, sensitive-key and string-pattern rules, circular-reference protection, deterministic replacements, immutable output, safe path-aware diagnostics, and no runtime third-party dependencies.

### Metrics / Telemetry v0.1

Release-gate Run 329 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `3c6f171f0469b34a055008b9594d043acb680f6c`.

The release provides bounded counters, gauges, deterministic cumulative histograms, metric and label validation, cardinality limits, immutable snapshots, deterministic JSON export, safe operational recording, and high-resolution timing using native Node timing primitives only.

### Worker Pool / Parallel Execution v0.1

Release-gate Run 322 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `073ab5b9a27f03d7441bec8549786cd8e8f28f57`.

### Serialization / Binary Codec v0.1

Release-gate Run 308 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `4e4ebf0bd503e72ec27d1984237b41ad47a56adb`.

### Digest / Hash v0.1

Release-gate Run 301 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `0500948a6a7c62492ca50ed2d93777baf7604809`.

### Stream / Pipeline v0.1

Release-gate Run 294 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `9ac578f0ebee01dc2825672a096daf3a4539ffe7`.

### Content-Encoding / Compression v0.1

Release-gate Run 290 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `ec31bec3c41804ec34d4ee961ef1b745aa306d61`.

### URL / Query / Encoding v0.1

Release-gate Run 281 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The release was squash-merged as `0e4f629d60e5c4566d2194ec6744c13ee57a7526`.

## Active milestone

### Canonical JSON / Normalization Cube v0.1

Target: a standalone deterministic canonicalization engine for JSON-safe values, producing stable normalized structures and canonical serialized JSON suitable for hashing, cache keys, signatures, snapshot comparison, and reproducible artifacts without third-party runtime dependencies.

Initial scope:
- JSON-safe primitives, arrays, and plain objects
- deterministic object-key ordering
- stable primitive serialization rules
- explicit handling of negative zero and finite numbers
- strict rejection of unsupported values
- bounded depth, node count, string size, and serialized output size
- immutable normalized output
- immutable configuration
- deterministic canonical JSON serialization
- typed fail-closed errors with safe diagnostics
- source immutability
- zero runtime third-party dependencies
- unit, contract, integration, failure, and recovery coverage
- cross-platform verification

Explicitly out of scope for v0.1:
- binary canonicalization formats
- cryptographic signing
- hashing APIs
- schema validation
- semantic normalization of dates, URLs, or domain-specific values
- network services
- third-party canonicalization packages

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
