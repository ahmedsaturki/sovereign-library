# Artifact Audit / Drift Reporter v0.1

Standalone deterministic local drift reporting for explicit artifact snapshots.

## Features

- baseline/current comparison
- unchanged/changed/added/removed classification
- digest/version/lifecycle/lineage drift detection
- bounded immutable findings
- fail-closed input validation
- deterministic checksum-protected report serialization
- zero runtime third-party dependencies

No network, registry, filesystem discovery, or automatic repair is performed.
