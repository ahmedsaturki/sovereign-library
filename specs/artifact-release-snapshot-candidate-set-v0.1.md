# Artifact Release Snapshot / Candidate Set v0.1

## Goal

Build a standalone deterministic local snapshot builder that freezes an explicit candidate artifact set for future release operations without discovering, mutating, publishing, or scheduling anything.

## Inputs

- explicit candidate artifact records
- optional bounded evidence references
- explicit snapshot configuration

## Evaluation contract

1. validate candidate identity, version, digest, admission verdict, and evidence references
2. reject duplicate identities and conflicting version/digest combinations
3. normalize candidate records into a stable deterministic representation
4. order candidates independently of input insertion order
5. produce exact bounded candidate counts and immutable identity records
6. prevent malformed, accessor, circular, invalid, or oversized values from entering the snapshot
7. serialize/parse a checksum-protected `SCS1` envelope deterministically
8. later valid snapshot creation recovers after rejected input
9. never discover or mutate external artifacts

## Safety / bounds

- finite candidate count
- finite evidence count
- finite string/value sizes
- finite metadata depth/nodes
- accessor and circular input rejection before normalization

## Out of scope

- external candidate discovery
- network/filesystem/registry scanning
- publication/deployment
- signing/trust-chain verification
- scheduling/orchestration
- automatic mutation or repair
- GUI/admin console
- billing or cost accounting

## Definition of done

SPEC, implementation, normal/failure/recovery tests, README, CHANGELOG, runnable example, package registration, clean-checkout verification, and GitHub Actions across Ubuntu, Windows, and macOS-15-Intel including real-browser smoke.

Release sequence:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`
