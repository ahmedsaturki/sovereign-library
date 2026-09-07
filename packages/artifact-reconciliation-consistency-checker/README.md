# Artifact Reconciliation / Consistency Checker v0.1

Standalone deterministic comparison of explicit artifact snapshots.

## What it checks

- missing and extra artifacts
- duplicate identities
- digest mismatches
- version mismatches
- lifecycle mismatches
- supplied lineage mismatches

Reports are immutable, bounded, deterministically ordered, and checksum-serializable. Source snapshots are never mutated. The core performs no network, registry, or filesystem discovery.
