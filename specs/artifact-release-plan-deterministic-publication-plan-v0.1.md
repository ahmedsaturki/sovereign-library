# Artifact Release Plan / Deterministic Publication Plan v0.1

## Goal

Build a standalone deterministic dry-run release-plan builder for explicit eligible artifacts, explicit dependencies, and explicit release constraints, with no publication side effects.

## Inputs

- explicit artifact records
- explicit dependency edges
- explicit release-plan configuration
- optional bounded admission evidence

## Evaluation contract

1. validate unique artifact ids and dependency references
2. validate required admission verdicts when supplied
3. reject cycles and impossible prerequisites before producing a plan
4. produce stable dependency-first ordering
5. generate bounded immutable release steps
6. preserve compact evidence references without copying source payloads
7. return a deterministic dry-run plan only; never publish or mutate
8. serialize/parse a checksum-protected `SRP1` envelope deterministically
9. later valid planning recovers after rejected input

## Safety / bounds

- finite artifact count
- finite dependency count
- finite step count
- finite evidence count
- finite string/value sizes
- circular/accessor rejection before evaluation

## Out of scope

- actual publication/deployment
- network/filesystem/registry discovery
- remote release APIs
- scheduling/orchestration
- signing/trust-chain verification
- automatic mutation or repair
- GUI/admin console

## Definition of done

SPEC, implementation, normal/failure/recovery tests, README, CHANGELOG, runnable example, package registration, clean-checkout verification, and GitHub Actions across Ubuntu, Windows, and macOS-15-Intel including real-browser smoke.

Release sequence:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`
