# Sovereign Library

A collection of **standalone, dependency-free software cubes** for building applications, tools, automations, agents, and products.

## The rule

Each cube is a complete product in its own right: independently usable, testable, documented, versioned, and replaceable. Cubes do not depend on other Sovereign cubes unless a contract explicitly says so.

We study proven implementations, open-source projects, standards, production failures, benchmarks, and expert practice. We extract useful ideas and implement the required capability as our own focused component. We do not copy code blindly; when source code is reused, applicable licenses and attribution requirements are preserved.

## Repository shape

```text
cubes/          standalone reusable products
contracts/      stable interchange contracts
adapters/       optional environment/external adapters
examples/       runnable examples
specs/          cube specifications and definition-of-done gates
tests/          repository verification
docs/           research and extraction notes
```

## Dependency policy

Target: **zero runtime third-party dependencies per cube**. Language standard libraries, operating-system primitives, open protocols, and web standards are allowed foundations. Third-party packages are not required by the core products.

A cube may use an external runtime such as Chromium when that external program is itself the capability being implemented (for example, Browser Cube uses Chromium through CDP), but the cube must not require a third-party automation framework or SDK.

## Cross-platform target

Windows, Linux, macOS, and WSL where the underlying capability is supported and verifiable.

## Release discipline

A cube is not released because source code exists. It is released only after contract tests, normal-path tests, failure/recovery tests, documentation, examples, clean-checkout verification, and platform checks pass.

The project follows one active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

## Current status

Released through v0.1:

- Browser
- HTTP Client
- Filesystem
- Process / Command
- Data Engine
- Storage
- WebSocket / Transport
- Task Scheduler / Queue
- Event / Signal
- Logger / Diagnostics
- Configuration / Environment
- Cache / Memoization
- Validation / Schema
- Result / Error
- Rate Limiter / Backpressure
- Retry / Resilience
- Concurrency / Bulkhead
- Circuit Breaker / Health Gate
- Timeout / Deadline
- HTTP Server / Router
- MIME / Multipart
- HTTP Metadata
- URL / Query / Encoding
- Content-Encoding / Compression
- Stream / Pipeline
- Digest / Hash
- Serialization / Binary Codec
- Worker Pool / Parallel Execution
- Metrics / Telemetry
- Redaction / Secret Safety
- Diff / Patch
- Canonical JSON / Normalization
- CLI / Command Runtime
- Search / Index
- Workflow / Durable Orchestration
- Storage Persistence / Snapshot
- Reporting / Export
- AI / Inference Runtime
- Agent Runtime
- Policy / Capability Security
- Execution Engine
- Release / Verification Harness
- Release Manifest / Integrity
- Content-Addressed Storage / CAS
- Artifact Bundle / Reproducible Package
- Local Artifact Catalog / Package Index
- Artifact Dependency Graph / Relationship Index
- Artifact Lifecycle / Retention Index
- Artifact Reference Resolver / Locator
- Artifact Provenance / Lineage Ledger
- Artifact Reconciliation / Consistency Checker
- Artifact Audit / Drift Reporter
- Artifact Compliance / Policy Evaluator
- Artifact Admission Gate / Release Eligibility
- Artifact Release Plan / Deterministic Publication Plan
- Artifact Release Snapshot / Candidate Set
- Artifact Release Approval / Decision Record
- Artifact Release Closure Receipt
- Artifact Release Publication Executor / Boundary
- Artifact Release Publication Confirmation / Outcome Receipt

The latest release is **Artifact Release Publication Confirmation / Outcome Receipt v0.1**, squash-merged as `ee642ac4f760da6ee6263faa5e82bf7d197fa78d` via PR #77. Pre-merge Run 573 and post-merge Run 574 passed across Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and the real-browser smoke gate.

## Active milestone

**NEXT-CUBE-SELECTION** — the previous cube is released and frozen. The next implementation will not begin until exactly one non-overlapping standalone cube is selected and its SPEC defines the public contract, limits, failure/recovery model, cross-platform target, tests, documentation, example, and release gate.

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material and do not assume unrestricted redistribution rights.
