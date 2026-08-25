# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Reporting / Export v0.1

PR #53 was squash-merged as `5f55612ca772d53a87de4e852e6695b71dba7a69`. Pre-merge Run 397 and post-merge Run 398 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, the full repository suite, and the real-browser smoke gate.

The release provides deterministic report snapshots, stable JSON/CSV exports, bounded async CSV streaming, deterministic filtering/order/grouping/aggregation, immutable results, typed fail-closed diagnostics, source immutability, public documentation/examples, and zero runtime third-party dependencies.

### Storage Persistence / Snapshot v0.1

PR #52 was squash-merged as `6ed90856cc66c9894ae948731769d23d0e9a40a5`. Pre-merge Run 389 and post-merge Run 390 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, the full repository suite, and the real-browser smoke gate.

### Workflow / Durable Orchestration v0.1

PR #51 was squash-merged as `f3b38368b7865aafd85e69b98f11f076f53b01be` after Run 379 passed on Ubuntu, Windows, and macOS-15-Intel. Post-merge Run 380 also passed on all three platforms.

### Search / Index v0.1

PR #50 was squash-merged as `e124f7cfa59880c0c0381863a5215f3bc2bd08f4`. Pre-merge Run 371 and post-merge Run 372 passed on all three platforms.

### CLI / Command Runtime v0.1

Release verification Run 366 passed on all three platforms. The cube was released at `61eac767bca438e63d28a28892ffcc0dab956e36`.

### Canonical JSON / Normalization v0.1

Pre-merge Run 352 and post-merge Run 353 passed on all three platforms. PR #49 was squash-merged as `66f9329182792d879dfb7bcfd2d49c6513d918b9`.

### Diff / Patch v0.1

Pre-merge Run 345 and post-merge Run 347 passed on all three platforms. PR #48 was squash-merged as `e1acaeea3ec0b02da8998ac30a2f910e64aa2ade`.

### Redaction / Secret Safety v0.1

Release-gate Run 341 passed on all three platforms. PR #45 was squash-merged as `e1040a0464f10f6e20d2ed39b5dd2e9097edae83`.

### Metrics / Telemetry v0.1

Release-gate Run 329 passed on all three platforms. The cube was squash-merged as `3c6f171f0469b34a055008b9594d043acb680f6c`.

### Worker Pool / Parallel Execution v0.1

Release-gate Run 322 passed on all three platforms. The cube was squash-merged as `073ab5b9a27f03d7441bec8549786cd8e8f28f57`.

### Serialization / Binary Codec v0.1

Release-gate Run 308 passed on all three platforms. The cube was squash-merged as `4e4ebf0bd503e72ec27d1984237b41ad47a56adb`.

### Digest / Hash v0.1

Release-gate Run 301 passed on all three platforms. The cube was squash-merged as `0500948a6a7c62492ca50ed2d93777baf7604809`.

### Stream / Pipeline v0.1

Release-gate Run 294 passed on all three platforms. The cube was squash-merged as `9ac578f0ebee01dc2825672a096daf3a4539ffe7`.

### Content-Encoding / Compression v0.1

Release-gate Run 290 passed on all three platforms. The cube was squash-merged as `ec31bec3c41804ec34d4ee961ef1b745aa306d61`.

### URL / Query / Encoding v0.1

Release-gate Run 281 passed on all three platforms. The release was squash-merged as `0e4f629d60e5c4566d2194ec6744c13ee57a7526`.

## Active milestone

### AI / Inference Runtime Cube v0.1

Target: a standalone provider-neutral local inference runtime for bounded message/context normalization, synchronous inference results, streaming delta events, cancellation/timeouts, and a native child-process/stdio adapter without shell execution or runtime third-party dependencies.

Initial scope:
- local in-process inference runtime coordination
- normalized system/user/assistant messages
- provider-neutral generation options
- bounded request/response/event payloads
- immutable request/result snapshots
- synchronous inference result contract
- streaming delta event contract
- cancellation and timeout handling
- native child-process stdio/NDJSON adapter without shell execution
- bounded stdout/stderr parsing
- typed fail-closed diagnostics
- unit, contract, integration, failure, and recovery coverage
- cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:
- model weights
- training/fine-tuning
- network provider clients
- provider SDK wrappers
- agent planning/tool orchestration
- RAG/vector databases
- embeddings/ranking
- multi-agent workflows
- GUI/chat application

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
