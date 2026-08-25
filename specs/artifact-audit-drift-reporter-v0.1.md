# Artifact Audit / Drift Reporter v0.1

## Product goal

A standalone deterministic local audit/reporting cube for detecting drift between explicit artifact states without mutating source data or performing hidden discovery.

## Public contract

- Inputs are explicit local artifact records or snapshots only.
- Baseline/current records are normalized deterministically.
- Each artifact is classified as unchanged, changed, added, or removed.
- Changed artifacts expose deterministic identity/digest/version/lifecycle/lineage drift categories.
- Findings have bounded severity/category metadata and stable ordering.
- Reports and snapshots are immutable.
- Malformed, accessor, circular, duplicate, and oversized inputs fail closed without partial state changes.
- Report serialization is deterministic and checksum protected.
- No network, registry, filesystem discovery, repair, or third-party SDK is required.

## Scope

Included: explicit local records, baseline/current diffing, drift classification, bounded immutable findings, deterministic report serialization, typed errors, tests, examples, documentation.

Excluded: remote synchronization, automatic discovery, automatic repair, distributed audit protocols, trust/signature policy engines, GUI/admin console, scheduler integration, billing.

## Definition of done

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Release requires syntax validation, full repository tests, browser smoke, normal-path tests, failure/recovery coverage, documentation, runnable example, deterministic report serialization, and successful verification on Ubuntu, Windows, and macOS-15-Intel.
