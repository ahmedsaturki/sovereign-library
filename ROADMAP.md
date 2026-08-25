# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

### Artifact Release Publication Confirmation / Outcome Receipt v0.1

PR #77 was squash-merged as `ee642ac4f760da6ee6263faa5e82bf7d197fa78d`. Pre-merge Run 573 passed on Ubuntu, Windows, and macOS-15-Intel after a minimal regression-fixture correction. Post-merge Run 574 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate.

The release hardened exact five-field closure identity linkage, deterministic plan/outcome linkage, bounded immutable confirmations, caller-supplied evidence/timestamps, optional bounded metadata, strict ISO-8601 normalization without system-clock access, SPC1 integrity protection, and fail-closed malformed/accessor/circular/oversized input handling.

### Artifact Release Publication Executor / Boundary v0.1

PR #76 was squash-merged as `23cf7b06e9162201683eb613d6c71c241cb5e34e`. Pre-merge Run 561 passed on Ubuntu, Windows, and macOS-15-Intel after a minimal accessor-regression fixture correction. Post-merge Run 562 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate.

### Artifact Release Closure Receipt / Finalization v0.1

PR #75 was squash-merged as `0e1adc1fc41924c4df14c5b10aa5ed1278297b90`. Pre-merge Run 555 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 556 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates. The Windows browser gate initially cancelled and was rerun independently; the rerun passed fully.

### Artifact Release Approval / Decision Record v0.1

PR #74 was squash-merged as `8f05e628d326c23c3d877742c2f2b7bd05c22aa9`. Pre-merge Run 549 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 550 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.

### Artifact Release Snapshot / Candidate Set v0.1

PR #73 was squash-merged as `62009ced973107cae4ef81c77f535d800e8692fe`. Pre-merge Run 543 passed on Ubuntu, Windows, and macOS-15-Intel after the deterministic serialization-test fix. Post-merge Run 544 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate.

### Artifact Release Plan / Deterministic Publication Plan v0.1

PR #72 was squash-merged as `80c1dcc1a653da8247fdabc0849ecf7d9139259c`. Pre-merge Run 536 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 537 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.

### Artifact Admission Gate / Release Eligibility v0.1

PR #71 was squash-merged as `29be5dc41556cb7aafa5fc0a4cd1ccb08ef2c157`. Pre-merge Run 530 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 531 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.

### Artifact Compliance / Policy Evaluator v0.1

PR #70 was squash-merged as `10ea69e80865fda16e385a635fa7bdde17162769`. Pre-merge Run 524 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate. Post-merge Run 525 passed on `main` across Ubuntu, Windows, and macOS-15-Intel with the same gates.

### Earlier released cubes

Artifact Audit / Drift Reporter `f939f13437412682600aad691998cae9d5218606`

Artifact Reconciliation / Consistency Checker `9dfb6833299cbfc42c82afdef5fcf2d3a6175833`

Artifact Provenance / Lineage Ledger `d1b2795d3a638100a6fbf657cbebeb5ef7aaae82`

Artifact Reference Resolver / Locator `7cb477e1e11ea5c5f9b145cf6eba1527482a4b57`

Artifact Lifecycle / Retention Index `da1f4992c0f84422f9e43a5c5037af1e28e85fc9`

Artifact Dependency Graph / Relationship Index `2616a058f90ae1469561dc508eaea812e43e0f99`

Local Artifact Catalog / Package Index `58fdd97ed36bf058843c83e2ad226a20d85fb446`

Artifact Bundle / Reproducible Package `a1d2655e7d48b63ce6ded71e4e449ea2c3a841dd`

Content-Addressed Storage / CAS `63ba1b7e684857e95303b02864c91627a6c601e0`

Release Manifest / Integrity `d1e33a2cfb12303cfe7e810e17241636ffa998db`

Release / Verification Harness `6e60d151691639948fabceaec1ee28964d40d881`

Execution Engine `739798bb3de3d50884dc7b3f28bada7e4f58f1a2`

Policy / Capability Security `a1067431f06d20ad2bdce321590ded9e79471d02`

Agent Runtime `8d4608e012176a55bdc1822d3aea65add7aa7669`

AI / Inference Runtime `83e076c3b0d8e0bc5e7f25c35e865cb9655121e9`

Reporting / Export `5f55612ca772d53a87de4e852e6695b71dba7a69`

Storage Persistence / Snapshot `6ed90856cc66c9894ae948731769d23d0e9a40a5`

Workflow / Durable Orchestration `f3b38368b7865aafd85e69b98f11f076f53b01be`

Search / Index `e124f7cfa59880c0c0381863a5215f3bc2bd08f4`

CLI / Command Runtime `61eac767bca438e63d28a28892ffcc0dab956e36`

Canonical JSON / Normalization `66f9329182792d879dfb7bcfd2d49c6513d918b9`

Diff / Patch `e1acaeea3ec0b02da8998ac30a2f910e64aa2ade`

Redaction / Secret Safety `e1040a0464f10f6e20d2ed39b5dd2e9097edae83`

Earlier cubes remain released at their recorded immutable SHAs.

## Active milestone

### NEXT-CUBE-SELECTION

The previous active cube is fully released and frozen. The control plane now intentionally stops implementation until exactly one next standalone cube is selected and specified.

Immediate task:
- identify one non-overlapping, independently valuable cube from parked work or a justified repository gap
- record its scope, public contract, limits, failure/recovery model, cross-platform target, and definition of done in a SPEC
- only then advance to IMPLEMENT

No new cube implementation starts before the SPEC gate is complete.

## Parked

Further capabilities remain parked until the next cube is selected and specified. Do not expand the frozen release or begin unrelated work.
