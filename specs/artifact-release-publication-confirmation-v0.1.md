# Artifact Release Publication Confirmation / Outcome Receipt v0.1

## Goal

Build a standalone deterministic confirmation receipt that converts one explicit executed publication outcome snapshot into an immutable, auditable handoff record for downstream reconciliation and audit cubes.

The receipt records what the caller says was executed. It does not execute publication, infer external truth, discover destinations, or invent timestamps/evidence.

## Inputs

- one explicit publication outcome snapshot produced by the Publication Executor
- one explicit originating closure receipt identity
- one finite caller-supplied confirmation metadata object
- one finite list of caller-supplied commit evidence references and timestamps

## Public contract

1. validate the originating closure receipt identity and require the outcome to reference the same receipt
2. validate every outcome against an explicit plan intent identity, destination id, artifact identity, and idempotency key
3. accept only known execution states: `succeeded`, `skipped_idempotent`, `failed`
4. produce confirmation records only from explicit outcome entries; never infer missing records
5. normalize confirmation ordering deterministically by intent id
6. preserve destination id, intent id, idempotency key, artifact identity/digest, execution state, and bounded commit evidence
7. accept timestamps only when explicitly supplied by the caller and validate them deterministically
8. reject duplicate confirmations, mismatched closure ids, plan/outcome conflicts, invalid states, malformed/accessor/circular inputs, and oversized evidence
9. produce an immutable confirmation receipt suitable for downstream audit/reconciliation
10. serialize and parse the receipt with deterministic checksum/integrity protection (`SPC1`)
11. recover cleanly after rejected input without poisoning later valid confirmation builds
12. perform no side effects and call no external services

## Confirmation state model

- `succeeded`: destination commit reported success
- `skipped_idempotent`: execution was intentionally skipped because the idempotency key was already committed
- `failed`: execution returned a terminal failure outcome

A failed outcome remains a record of the executor result; the confirmation cube does not retry or repair it.

## Evidence and timestamps

Evidence values are caller-supplied opaque bounded references. The cube must not fetch, resolve, verify, or reinterpret them.

Timestamps must be supplied as explicit ISO-8601 strings and are normalized only for deterministic representation. The cube does not call the system clock.

## Serialization

Use a versioned checksum-protected envelope (`SPC1`) with deterministic canonical payload ordering and corruption detection.

## Out of scope

- executing publication side effects
- external audit/reconciliation services
- destination discovery
- signing/trust-chain generation or verification
- scheduler/orchestration
- automatic retries
- credential management
- GUI/admin console
- billing or cost accounting

## Definition of done

SPEC, implementation, normal-path tests, failure/recovery tests, idempotency tests, documentation, runnable example, package registration, clean-checkout verification, and GitHub Actions across Ubuntu, Windows, and macOS-15-Intel including real-browser smoke.

Release sequence:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`
