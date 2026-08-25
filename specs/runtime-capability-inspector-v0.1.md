# Runtime Capability Inspector v0.1

## Goal

Build a standalone local runtime capability inspector that captures bounded host/runtime facts, checks explicitly requested executable availability without executing commands, evaluates a declarative capability requirement set, and produces deterministic immutable reports suitable for preflight, diagnostics, installers, CI gates, and downstream automation.

The cube observes the local environment. It does not change it, execute arbitrary commands, install software, contact external services, or expose secrets.

## Public API

- `inspectRuntime(options?)` — capture a bounded immutable runtime snapshot.
- `evaluateRuntimeRequirements(snapshot, requirements)` — pure deterministic requirement evaluation.
- `serializeRuntimeReport(report)` — deterministic `RCI1` checksum-protected serialization.
- `parseRuntimeReport(serialized)` — integrity-checked immutable parsing.
- exported constants for format and supported predicates.

## Snapshot contract

The snapshot may contain:

- OS family and release information
- CPU architecture and endianness
- Node.js runtime version and major/minor/patch values
- CPU count and total memory bytes when available
- selected environment capability metadata such as PATH presence, without returning environment values
- explicit executable availability results for caller-requested bounded executable names

Environment variables and secrets are never copied into the snapshot. Only boolean capability facts are retained.

## Executable probing contract

Executable probing is allowlisted by the caller-supplied names. The cube:

1. reads PATH directories from the current process environment
2. checks candidate executable paths using filesystem metadata only
3. honors platform executable extensions on Windows
4. never spawns the executable
5. never downloads, installs, or invokes shells
6. bounds executable count, name length, PATH entries, and inspected paths

A missing executable is a normal negative capability result, not a thrown operational failure.

## Requirement model

Requirements are plain data and may include:

- `os`: one or more accepted OS families
- `architectures`: one or more accepted architectures
- `nodeMajorMin`, `nodeMajorMax`
- `requiredExecutables`: executable names that must be available
- `minCpuCount`
- `minMemoryBytes`

The evaluator returns an immutable deterministic verdict with ordered failures. It never probes again and never changes the snapshot.

## Determinism and serialization

Observation itself is allowed to vary between hosts and points in time. Normalization, requirement evaluation, ordering, cloning, and serialization must be deterministic for identical inputs.

Use a versioned checksum-protected `RCI1` envelope with canonical JSON payload ordering and a SHA-256 checksum.

## Failure and recovery

Reject, before any partial report is published:

- accessor-backed objects
- circular values
- unsupported JSON values
- malformed requirement definitions
- invalid IDs/names
- duplicate executable requests
- oversized lists/strings
- impossible numeric bounds
- malformed serialized envelopes
- checksum corruption

After rejected input, a later independent valid call must work normally. The cube has no global mutable state.

## Side-effect boundary

Allowed: read-only inspection of process/runtime metadata and filesystem metadata required for PATH executable availability checks.

Forbidden: command execution, child processes, shell evaluation, network access, package installation, registry mutation, credential access, persistence, scheduling, telemetry, or GUI behavior.

## Cross-platform target

- Ubuntu/Linux
- Windows
- macOS-15-Intel
- WSL where the underlying Node.js APIs are available

## Bounds

- executable requests: 64
- PATH entries examined: 128
- executable-name length: 256 characters
- serialized payload: 64 KiB
- requirement lists: 32 entries each
- object depth: 12

## Definition of done

SPEC, implementation, normal-path tests, failure/recovery tests, requirement-evaluation tests, deterministic serialization tests, runnable example, README, changelog, package registration, clean-checkout verification, and GitHub Actions across Ubuntu, Windows, and macOS-15-Intel including real-browser smoke.

Release sequence:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`
