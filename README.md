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

Every released cube has been verified through GitHub Actions across Ubuntu, Windows, and macOS-15-Intel, including the repository's real-browser smoke gate.

## Active milestone

**Policy / Capability Security Cube v0.1** — standalone deterministic local capability-policy engine for immutable policy snapshots, explicit allow/deny rules, hierarchical resource/action matching, deterministic precedence, bounded contextual evaluation, fail-closed diagnostics, and immutable audit decision records.

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material and do not assume unrestricted redistribution rights.
