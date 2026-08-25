# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### AI / Inference Runtime v0.1

PR #54 was squash-merged as `83e076c3b0d8e0bc5e7f25c35e865cb9655121e9`. Pre-merge Run 403 and post-merge Run 404 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, the full repository suite, and the real-browser smoke gate.

The release provides provider-neutral message normalization, immutable request/result snapshots, synchronous and streaming inference contracts, cancellation/timeout handling, a native child-process/NDJSON adapter without shell invocation, bounded stdout/stderr/diagnostics, typed fail-closed errors, public documentation/examples, and zero runtime third-party dependencies.

### Reporting / Export v0.1

PR #53 was squash-merged as `5f55612ca772d53a87de4e852e6695b71dba7a69`. Pre-merge Run 397 and post-merge Run 398 passed on Ubuntu, Windows, and macOS-15-Intel.

### Storage Persistence / Snapshot v0.1

PR #52 was squash-merged as `6ed90856cc66c9894ae948731769d23d0e9a40a5`. Pre-merge Run 389 and post-merge Run 390 passed on all three platforms.

### Workflow / Durable Orchestration v0.1

PR #51 was squash-merged as `f3b38368b7865aafd85e69b98f11f076f53b01be` after Run 379 and post-merge Run 380 passed on all three platforms.

### Search / Index v0.1

PR #50 was squash-merged as `e124f7cfa59880c0c0381863a5215f3bc2bd08f4` after pre/post verification on all three platforms.

### CLI / Command Runtime v0.1

Released at `61eac767bca438e63d28a28892ffcc0dab956e36` after cross-platform release verification.

### Canonical JSON / Normalization v0.1

PR #49 was squash-merged as `66f9329182792d879dfb7bcfd2d49c6513d918b9` after pre/post verification on all three platforms.

### Diff / Patch v0.1

PR #48 was squash-merged as `e1acaeea3ec0b02da8998ac30a2f910e64aa2ade` after pre/post verification on all three platforms.

### Redaction / Secret Safety v0.1

PR #45 was squash-merged as `e1040a0464f10f6e20d2ed39b5dd2e9097edae83` after release verification on all three platforms.

### Metrics / Telemetry v0.1

Released as `3c6f171f0469b34a055008b9594d043acb680f6c` after cross-platform release verification.

### Worker Pool / Parallel Execution v0.1

Released as `073ab5b9a27f03d7441bec8549786cd8e8f28f57` after cross-platform release verification.

### Serialization / Binary Codec v0.1

Released as `4e4ebf0bd503e72ec27d1984237b41ad47a56adb` after cross-platform release verification.

### Digest / Hash v0.1

Released as `0500948a6a7c62492ca50ed2d93777baf7604809` after cross-platform release verification.

### Stream / Pipeline v0.1

Released as `9ac578f0ebee01dc2825672a096daf3a4539ffe7` after cross-platform release verification.

### Content-Encoding / Compression v0.1

Released as `ec31bec3c41804ec34d4ee961ef1b745aa306d61` after cross-platform release verification.

### URL / Query / Encoding v0.1

Released as `0e4f629d60e5c4566d2194ec6744c13ee57a7526` after cross-platform release verification.

## Active milestone

### Agent Runtime Cube v0.1

Target: a standalone native agent runtime for deterministic session/turn state, bounded conversation context, explicit tool-call contracts, capability allowlisting, cancellation/timeout/retry semantics, recoverable immutable session snapshots, and zero runtime third-party dependencies.

Initial scope:
- immutable agent definitions/configuration
- deterministic session/turn state machine
- bounded conversation context
- explicit tool registry and capability allowlisting
- typed tool-call request/result envelopes
- cancellation, timeout, retry, and terminal-state behavior
- bounded step/tool/output/diagnostic work
- recoverable immutable session snapshots
- typed fail-closed diagnostics
- unit, contract, integration, failure, and recovery coverage
- cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:
- multi-agent orchestration
- network tool marketplaces
- vector databases/RAG
- embeddings/ranking
- GUI/chat application
- model training/fine-tuning
- provider SDKs
- browser automation features
- remote deployment/control plane

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
