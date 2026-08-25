# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Search / Index v0.1

Release PR #50 was squash-merged as `e124f7cfa59880c0c0381863a5215f3bc2bd08f4`. Pre-merge Run 371 passed after the macOS-only timing-sensitive Worker Pool test was rerun; Search-specific tests were green. Post-merge Run 372 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, the full repository suite, and the real-browser smoke gate.

The release provides a deterministic native in-memory inverted index with NFKC/Unicode tokenization, add/update/remove/rebuild lifecycle, exact/AND/OR/prefix/phrase queries, bounded TF-IDF-like scoring, deterministic result ordering, copy-on-write mutations, transactional rebuilds, immutable public results/snapshots, typed fail-closed diagnostics, and zero runtime third-party dependencies.

### CLI / Command Runtime v0.1

Release verification Run 366 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, the full repository suite, and the real-browser smoke gate. The cube was released through the direct-main gated path at `61eac767bca438e63d28a28892ffcc0dab956e36`.

The release provides deterministic argv parsing, short and long options, typed values, repeatable options, grouped boolean flags, subcommand routing, positional validation, deterministic help/version output, bounded argument and output sizes, explicit stdin/stdout/stderr handling, deterministic exit-code mapping, explicit environment allowlisting, immutable configuration, accessor-safe validation, typed fail-closed diagnostics, public documentation, runnable examples, and zero runtime third-party dependencies.

### Canonical JSON / Normalization v0.1

Release-gate Run 352 passed on Ubuntu, Windows, and macOS-15-Intel before merge. Post-merge Run 353 also passed on all three platforms with syntax checks, the full repository suite, and the real-browser smoke gate. The cube was squash-merged through PR #49 as `66f9329182792d879dfb7bcfd2d49c6513d918b9`.

The release provides deterministic canonicalization for JSON-safe values, stable object-key ordering, explicit negative-zero and finite-number semantics, immutable normalized structures, deterministic canonical JSON serialization, bounded traversal/string/output work, strict unsupported/accessor rejection, circular-reference detection, typed fail-closed diagnostics, source immutability, runnable documentation/examples, and zero runtime third-party dependencies.

### Diff / Patch v0.1

Release-gate Run 345 completed the pre-merge verification and Run 347 completed the post-merge verification on `main`. Ubuntu, Windows, and macOS-15-Intel all passed syntax checks, the full repository suite, and the real-browser smoke gate. The cube was squash-merged through PR #48 as `e1acaeea3ec0b02da8998ac30a2f910e64aa2ade`.

### Redaction / Secret Safety v0.1

Release-gate Run 341 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real-browser smoke test. The cube was squash-merged as `e1040a0464f10f6e20d2ed39b5dd2e9097edae83` through PR #45.

### Metrics / Telemetry v0.1

Release-gate Run 329 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real Browser smoke test. The cube was squash-merged as `3c6f171f0469b34a055008b9594d043acb680f6c`.

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

Release-gate Run 281 passed on Ubuntu, Windows, and macOS-15-Intel with the full repository suite and real-browser smoke. The release was squash-merged as `0e4f629d60e5c4566d2194ec6744c13ee57a7526`.

## Active milestone

### Workflow / Durable Orchestration Cube v0.1

Target: a standalone deterministic local workflow engine for durable in-process orchestration, with sequential/parallel/conditional steps, replayable execution history, retries, timeouts, cancellation, idempotency, immutable snapshots, bounded history/work, and zero runtime third-party dependencies.

Initial scope:
- local in-process workflow definitions
- deterministic step state machine
- sequential and bounded parallel execution
- deterministic conditional branching
- durable in-memory execution history
- replay from history
- retry and timeout policy
- cancellation propagation
- idempotent step execution keys
- bounded fan-out and history/payload sizes
- immutable execution snapshots/results
- source immutability
- typed fail-closed diagnostics
- unit, contract, integration, failure, and recovery coverage
- cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:
- network orchestration
- distributed workers
- external durable databases
- cron/scheduled triggers
- third-party workflow engines
- remote queues
- BPMN/visual editors
- external service integrations
- learned planning or agent behavior

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
