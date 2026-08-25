# Artifact Reference Resolver / Locator v0.1

## Goal

Provide a standalone deterministic local resolver for artifact references against an explicit bounded candidate set.

## Contract

Accepted reference forms are explicit and version-range-free:

- `name`
- `name:version`
- `name@version`
- `name#digest`
- `name:version#digest`
- `name@version#digest`
- `name@tag`

Names, versions, tags, and digests are normalized into immutable canonical references. No semantic-version range solving is performed.

## Resolution

The resolver receives candidates explicitly from the caller. It never scans the filesystem, accesses a registry, performs network I/O, or consults an implicit global catalog.

Resolution order is deterministic:

1. exact digest match when a digest is present
2. exact canonical name/version match
3. exact canonical name/tag alias match
4. exact name-only match only when there is one unambiguous candidate

More than one matching candidate is an `AMBIGUOUS_REFERENCE` failure. No candidate is a `REFERENCE_NOT_FOUND` failure.

## Safety / bounds

All inputs, candidate counts, field lengths, and result counts are bounded. Accessors, circular structures, malformed references, duplicate candidate identities, and unsupported values fail closed before arbitrary getters execute.

## Immutability

Normalized references, candidate snapshots, resolution decisions, and resolver configuration are immutable snapshots. Caller-owned inputs are never mutated.

## Recovery

A failed resolve call must not poison later valid calls. Reusing a resolver after invalid input must remain deterministic.

## Dependencies

Zero runtime third-party dependencies. Node.js standard library only.

## Verification

Required before release:

- syntax checks
- unit tests
- contract tests
- ambiguity/not-found failure tests
- malformed/accessor/circular input tests
- bounds and recovery tests
- cross-platform GitHub Actions on Ubuntu, Windows, and macOS-15-Intel
- repository real-browser smoke gate
- README, changelog, and runnable example
