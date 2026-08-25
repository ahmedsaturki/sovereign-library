# Sovereign Library

A collection of standalone, dependency-free software cubes for applications, tools, automations, agents, and products.

## Release rule

Each cube is independently usable, documented, tested, cross-platform, failure/recovery hardened, and replaceable.

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

## Dependency policy

Target: zero runtime third-party dependencies per cube. Standard libraries and native OS primitives are allowed foundations.

## Cross-platform target

Windows, Linux, macOS, and WSL where the capability is supported.

## Released through v0.1

The repository includes the core Browser, HTTP, Filesystem, Process, Data, Storage, Transport, Scheduling, Eventing, Diagnostics, Configuration, Resilience, Concurrency, HTTP Server, Encoding, Streaming, Digest, Serialization, Worker, Metrics, Security, Diff, Canonical JSON, CLI, Search, Workflow, Persistence, Reporting, AI, Agent, Policy, Execution, Release, Artifact, Runtime Capability, Filesystem Watcher, File Lease, Ephemeral Workspace, and Atomic File Writer cubes.

### Latest release

**Atomic File Writer / Safe Replace v0.1** — finalized by corrective PR #84 at `4479ae230ccc0ec4ecc1875fcbd16919a80e71bf`.

The corrective release fixed a real Node 24 compatibility issue in the default `fsync` capability without changing the public contract. Corrective Run #622 and post-merge Run #623 passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.

## Active milestone

**Directory Snapshot / Tree Manifest v0.1 SPEC** — the next standalone product. It will own deterministic local directory inventory, stable entry representation and ordering, optional file digesting, explicit symlink policy, bounded manifest generation, and clear concurrent-mutation/error semantics without becoming a sync, watch, storage, or database framework.

## Repository shape

```text
cubes/ contracts/ adapters/ examples/ specs/ tests/ docs/
```

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material.
