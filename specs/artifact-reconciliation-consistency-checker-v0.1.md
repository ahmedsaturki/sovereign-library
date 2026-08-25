# Artifact Reconciliation / Consistency Checker v0.1

## Product goal

A standalone deterministic local checker for comparing explicit artifact snapshots and reporting missing, extra, duplicate, identity, digest, version, lifecycle, and lineage inconsistencies without mutating source snapshots.

## Public contract

- Inputs are explicit bounded snapshot objects supplied by the caller.
- Artifact identity is canonical and deterministic.
- Comparison does not mutate either source snapshot.
- Missing and extra records are reported deterministically.
- Duplicate identities are reported explicitly.
- Identity/digest/version/lifecycle conflicts are classified into stable categories.
- Supplied lineage references are checked for missing targets and self/conflicting relationships.
- Reports have deterministic category/severity ordering and bounded mismatch counts.
- Malformed/accessor/circular/oversized inputs fail closed.
- Reports are immutable snapshots and serializable with checksum/integrity protection.
- No network, filesystem, registry discovery, or external SDK is used by the core.
- Zero runtime third-party dependencies.

## Scope

Included: explicit snapshot normalization, deterministic comparison, bounded mismatch reporting, identity/digest/version/lifecycle/lineage checks, immutable reports, typed errors, checksum-protected report serialization, unit/contract/failure/recovery tests, examples and documentation.

Excluded: remote synchronization, automatic discovery, automatic repair/mutation, distributed reconciliation protocols, signature/trust policy engines, GUI/admin console, scheduler integration, billing.

## Definition of done

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Release requires syntax validation, full repository tests, real-browser smoke, failure/recovery coverage, deterministic output, documentation, runnable example, and Ubuntu/Windows/macOS-15-Intel verification.
