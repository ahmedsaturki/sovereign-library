# Artifact Release Approval / Decision Record v0.1

## Goal

Build a standalone deterministic local approval record bound to one explicit frozen release snapshot and explicit approval decisions. The cube records decisions; it does not call external approval services and it never publishes artifacts.

## Inputs

- explicit frozen snapshot identity (`snapshotId`, `snapshotChecksum`)
- explicit required/optional approval scopes
- explicit decision records

## Decision contract

Each decision contains a stable id, reviewer/actor id, scope, state, and bounded evidence references. Supported states are `approve`, `reject`, and `abstain`.

The evaluator must:

1. validate snapshot identity and checksum shape
2. validate decision identity, reviewer id, scope, state, and evidence refs
3. reject duplicate decision ids
4. reject conflicting decisions for one reviewer/scope pair
5. normalize decisions deterministically
6. compute required-scope status deterministically
7. produce immutable bounded approval status and decision summaries
8. fail closed on malformed, accessor, circular, invalid, duplicate, conflicting, and oversized input
9. serialize/parse an `SAD1` checksum-protected envelope deterministically
10. recover cleanly after rejected input

## Status semantics

- `approved`: every required scope has at least one `approve` decision and no `reject` decision
- `rejected`: any required scope has a `reject` decision
- `pending`: required scopes remain unresolved and no required scope is rejected
- optional scopes do not block approval unless explicitly marked required

## Out of scope

- external approval services
- network/filesystem/registry discovery
- publication/deployment
- signing/trust-chain verification
- scheduling/orchestration
- automatic mutation or repair
- GUI/admin console
- billing or cost accounting

## Definition of done

SPEC, implementation, normal/failure/recovery tests, README, CHANGELOG, runnable example, package registration, clean-checkout verification, and GitHub Actions across Ubuntu, Windows, and macOS-15-Intel including the real-browser smoke gate.

Release sequence:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`
