# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Execution Engine v0.1

PR #57 was squash-merged as `739798bb3de3d50884dc7b3f28bada7e4f58f1a2`. Pre-merge Run 424 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 425 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.

The release provides deterministic dependency-aware task execution, explicit success/failure/cancel/timeout/skipped outcomes, bounded execution and diagnostics, retry/recovery, immutable snapshots/results, typed fail-closed errors, and zero runtime third-party dependencies.

### Policy / Capability Security v0.1

PR #56 was squash-merged as `a1067431f06d20ad2bdce321590ded9e79471d02`. Pre-merge Run 418 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, contract/integration tests, and the real-browser smoke gate. Post-merge Run 419 passed on `main` with the same gates.

### Agent Runtime v0.1

PR #55 was squash-merged as `8d4608e012176a55bdc1822d3aea65add7aa7669`. Pre-merge Run 409 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 410 was a successful push verification on `main`.

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

### Release / Verification Harness v0.1

Target: a standalone deterministic local release-verification harness that executes explicit verification stages, safely runs allowlisted local commands without shell dependence, applies bounded timeout/cancellation/retry semantics, and emits immutable machine-readable release verdicts.

Initial scope:
- immutable stage definitions and normalized commands
- deterministic stage ordering and lifecycle states
- native child-process execution without shell dependence
- bounded stdout/stderr capture and diagnostics
- per-stage timeout, cancellation, retry, and terminal outcomes
- deterministic pass/fail/skip aggregation
- immutable verification snapshots and reports
- typed fail-closed errors and safe command validation
- unit, contract, failure, recovery, and cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:
- hosted CI provider SDKs
- remote execution
- secrets management
- distributed agents
- GUI/admin console
- browser automation implementation

## Parked

Further capabilities remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
