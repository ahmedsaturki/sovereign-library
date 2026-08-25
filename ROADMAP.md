# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Agent Runtime v0.1

PR #55 was squash-merged as `8d4608e012176a55bdc1822d3aea65add7aa7669`. Pre-merge Run 409 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, the full repository suite, and the real-browser smoke gate. Post-merge Run 410 was a push on `main` for the release commit and completed successfully.

The release provides deterministic agent/session state, bounded conversation and tool work, explicit tool-call envelopes and capability allowlisting, cancellation/timeout/retry semantics, immutable snapshots, typed fail-closed diagnostics, public documentation/examples, and zero runtime third-party dependencies.

### AI / Inference Runtime v0.1

PR #54 was squash-merged as `83e076c3b0d8e0bc5e7f25c35e865cb9655121e9`. Pre-merge Run 403 and post-merge Run 404 passed on Ubuntu, Windows, and macOS-15-Intel.

### Reporting / Export v0.1

PR #53 was squash-merged as `5f55612ca772d53a87de4e852e6695b71dba7a69` after cross-platform verification.

### Storage Persistence / Snapshot v0.1

PR #52 was squash-merged as `6ed90856cc66c9894ae948731769d23d0e9a40a5` after cross-platform verification.

### Workflow / Durable Orchestration v0.1

PR #51 was squash-merged as `f3b38368b7865aafd85e69b98f11f076f53b01be` after cross-platform verification.

### Search / Index v0.1

PR #50 was squash-merged as `e124f7cfa59880c0c0381863a5215f3bc2bd08f4` after cross-platform verification.

### CLI / Command Runtime v0.1

Released at `61eac767bca438e63d28a28892ffcc0dab956e36` after cross-platform release verification.

### Canonical JSON / Normalization v0.1

PR #49 was squash-merged as `66f9329182792d879dfb7bcfd2d49c6513d918b9` after cross-platform verification.

### Diff / Patch v0.1

PR #48 was squash-merged as `e1acaeea3ec0b02da8998ac30a2f910e64aa2ade` after cross-platform verification.

### Redaction / Secret Safety v0.1

PR #45 was squash-merged as `e1040a0464f10f6e20d2ed39b5dd2e9097edae83` after release verification.

### Earlier released cubes

Metrics / Telemetry `3c6f171f0469b34a055008b9594d043acb680f6c`

Worker Pool / Parallel Execution `073ab5b9a27f03d7441bec8549786cd8e8f28f57`

Serialization / Binary Codec `4e4ebf0bd503e72ec27d1984237b41ad47a56adb`

Digest / Hash `0500948a6a7c62492ca50ed2d93777baf7604809`

Stream / Pipeline `9ac578f0ebee01dc2825672a096daf3a4539ffe7`

Content-Encoding / Compression `ec31bec3c41804ec34d4ee961ef1b745aa306d61`

URL / Query / Encoding `0e4f629d60e5c4566d2194ec6744c13ee57a7526`

## Active milestone

### Policy / Capability Security Cube v0.1

Target: a standalone deterministic local capability-policy engine that provides immutable policy snapshots, explicit allow/deny rules, hierarchical resource/action matching, deterministic precedence, bounded contextual evaluation, fail-closed diagnostics, and immutable audit decision records.

Initial scope:
- immutable policy definitions and normalization
- explicit allow/deny capability records
- hierarchical resource/action matching
- deterministic precedence and conflict resolution
- bounded contextual inputs
- fail-closed evaluation on malformed rules and unsupported values
- immutable safe audit decision records
- policy composition/versioned snapshots
- unit, contract, failure, recovery, and cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:
- network authorization services
- OAuth/OIDC providers
- remote policy control planes
- identity lifecycle management
- distributed consensus
- multi-agent orchestration
- GUI/admin console
- browser automation

## Parked

Further capabilities remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
