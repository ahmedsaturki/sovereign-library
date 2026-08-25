# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Artifact Admission Gate / Release Eligibility v0.1

PR #71 was squash-merged as `29be5dc41556cb7aafa5fc0a4cd1ccb08ef2c157`. Pre-merge Run 530 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 531 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.

### Artifact Compliance / Policy Evaluator v0.1

PR #70 was squash-merged as `10ea69e80865fda16e385a635fa7bdde17162769`. Pre-merge Run 524 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 525 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.

### Artifact Audit / Drift Reporter v0.1

PR #69 was squash-merged as `f939f13437412682600aad691998cae9d5218606`. Pre-merge Run 511 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 512 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.

### Artifact Reconciliation / Consistency Checker v0.1

PR #68 was squash-merged as `9dfb6833299cbfc42c82afdef5fcf2d3a6175833`. Pre-merge Run 504 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 505 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.

### Artifact Provenance / Lineage Ledger v0.1

PR #67 was squash-merged as `d1b2795d3a638100a6fbf657cbebeb5ef7aaae82`. Pre-merge Run 497 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 498 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.

### Artifact Reference Resolver / Locator v0.1

PR #66 was squash-merged as `7cb477e1e11ea5c5f9b145cf6eba1527482a4b57`.

### Artifact Lifecycle / Retention Index v0.1

PR #65 was squash-merged as `da1f4992c0f84422f9e43a5c5037af1e28e85fc9`.

### Artifact Dependency Graph / Relationship Index v0.1

PR #64 was squash-merged as `2616a058f90ae1469561dc508eaea812e43e0f99`.

### Local Artifact Catalog / Package Index v0.1

PR #63 was squash-merged as `58fdd97ed36bf058843c83e2ad226a20d85fb446`.

### Artifact Bundle / Reproducible Package v0.1

PR #62 was squash-merged as `a1d2655e7d48b63ce6ded71e4e449ea2c3a841dd` after full cross-platform verification.

### Content-Addressed Storage / CAS v0.1

PR #61 was squash-merged as `63ba1b7e684857e95303b02864c91627a6c601e0` after full cross-platform verification.

### Release Manifest / Integrity v0.1

PR #59 was squash-merged as `d1e33a2cfb12303cfe7e810e17241636ffa998db` after full cross-platform verification.

### Release / Verification Harness v0.1

PR #58 was squash-merged as `6e60d151691639948fabceaec1ee28964d40d881` after cross-platform verification.

### Execution Engine v0.1

PR #57 was squash-merged as `739798bb3de3d50884dc7b3f28bada7e4f58f1a2` after cross-platform verification.

### Policy / Capability Security v0.1

PR #56 was squash-merged as `a1067431f06d20ad2bdce321590ded9e79471d02` after cross-platform verification.

### Agent Runtime v0.1

PR #55 was squash-merged as `8d4608e012176a55bdc1822d3aea65add7aa7669` after cross-platform verification.

### AI / Inference Runtime v0.1

PR #54 was squash-merged as `83e076c3b0d8e0bc5e7f25c35e865cb9655121e9` after cross-platform verification.

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

Digest / Hash `0500948a6a7c62492ca50ed2d93777baf760480`

Stream / Pipeline `9ac578f0ebee01dc2825672a096daf3a4539ffe7`

Content-Encoding / Compression `ec31bec3c41804ec34d4ee961ef1b745aa306d61`

URL / Query / Encoding `0e4f629d60e5c4566d2194ec6744c13ee57a7526`

## Active milestone

### Artifact Release Plan / Deterministic Publication Plan v0.1

Target: a standalone deterministic local builder for dry-run release plans over explicit eligible artifacts, explicit dependencies, and explicit release constraints, with no publication side effects.

Initial scope:
- explicit artifact data and explicit release-plan configuration only
- uniqueness and dependency validation
- required admission verdict validation
- deterministic dependency ordering and release step generation
- cycle and impossible prerequisite detection
- bounded immutable dry-run plans and dependency evidence
- deterministic checksum-protected plan serialization
- unit, contract, failure, recovery, and cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:
- actual publication or deployment
- network/filesystem/registry discovery
- remote release APIs
- background scheduling/orchestration
- signing/trust-chain verification
- automatic artifact mutation or repair
- GUI/admin console
- billing or cost accounting

## Parked

Further capabilities remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
