# Artifact Release Closure Receipt v0.1

## Goal

Build a standalone deterministic local closure receipt that links one explicit frozen release snapshot to one explicit approved decision record. The receipt is an immutable handoff artifact; it does not publish or mutate anything.

## Inputs

- explicit frozen release snapshot identity and checksum
- explicit approved decision record identity and checksum/status
- explicit bounded closure metadata and evidence references

## Contract

1. validate snapshot identity/checksum
2. validate approval record identity/checksum and require `approved` status
3. verify snapshot/approval linkage is exact
4. normalize closure metadata and evidence deterministically
5. reject duplicate receipt ids, invalid metadata, mismatched links, non-approved decisions, accessors, circular values, and oversized inputs
6. produce an immutable bounded `closure` receipt
7. serialize/parse a checksum-protected `SRC1` envelope deterministically
8. recover cleanly after rejected input
9. never publish, mutate, discover, or call external services

## Out of scope

- publication/deployment
- external release services
- network/filesystem/registry discovery
- signing/trust-chain verification
- scheduling/orchestration
- automatic mutation or repair
- GUI/admin console
- billing or cost accounting

## Definition of done

SPEC, implementation, normal/failure/recovery tests, README, CHANGELOG, runnable example, package registration, clean-checkout verification, and GitHub Actions across Ubuntu, Windows, and macOS-15-Intel including real-browser smoke.

Release sequence:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`
