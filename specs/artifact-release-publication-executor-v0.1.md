# Artifact Release Publication Executor / Boundary v0.1

## Goal

Build a standalone deterministic publication boundary that consumes one explicit frozen `Artifact Release Closure Receipt` and executes only explicitly authorized publication intents against explicitly declared destinations.

The cube is the first side-effecting release component. Its job is to make publication authority explicit, bounded, idempotent, auditable, and fail-closed. It must never discover destinations, credentials, or artifacts on its own.

## Inputs

- one explicit frozen closure receipt
- one finite list of explicit publication intents
- one finite allowlist of explicit destination capability definitions
- bounded execution configuration and idempotency keys

## Public contract

1. validate closure receipt identity, checksum, and `closed`/approved compatibility before any side effect
2. validate every intent identity, target destination id, operation, artifact identity, and bounded metadata
3. require destination capability to be explicitly declared and operation-allowlisted
4. normalize intents and destinations deterministically
5. reject duplicate/conflicting intents, unsupported destinations, mismatched closure data, malformed/accessor/circular values, and oversized inputs
6. produce an immutable deterministic publication plan before execution
7. execute only the planned side-effect boundaries exposed by the destination capability
8. record typed immutable outcomes per intent: `succeeded`, `skipped_idempotent`, or typed terminal failure
9. provide deterministic idempotency semantics: a previously committed intent key cannot execute twice
10. never mutate unrelated state when a preflight validation fails
11. recover cleanly after rejected inputs and retry-safe failures without poisoning later valid executions
12. serialize plan/outcome snapshots deterministically with checksum/integrity protection

## Destination capability contract

A destination definition must explicitly provide:

- stable destination id
- finite operation allowlist
- explicit `prepare`, `commit`, and optional `rollbackSafe` boundaries
- bounded input/output contracts
- deterministic idempotency behavior

The core cube must not contain implicit implementations for cloud registries, artifact stores, package registries, deployment platforms, or credential managers.

## Side-effect safety

No side effect may occur before preflight validation and deterministic planning succeed.

A failed intent must not silently execute another intent.

Rollback is represented only as an explicit capability property; v0.1 must not invent compensating actions that the destination did not declare.

## Serialization

Use a versioned checksum-protected envelope (`SPE1` for publication execution snapshots) with deterministic canonical payload ordering and corruption detection.

## Out of scope

- destination discovery
- secret or credential acquisition
- network/filesystem scanning
- scheduler/orchestrator ownership
- automatic credential refresh
- automatic trust/signature generation
- broad platform adapters
- GUI/admin console
- billing/cost accounting

## Definition of done

SPEC, implementation, normal-path tests, failure/recovery tests, idempotency tests, rollback-safety tests, documentation, runnable example, package registration, and GitHub Actions across Ubuntu, Windows, and macOS-15-Intel including real-browser smoke.

Release sequence:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`
