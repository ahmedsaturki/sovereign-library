# Changelog

## Unreleased

### Continuity-Hardening Wave (feat/continuity-hardening)

- Pinned every GitHub Actions `uses:` reference to a 40-char commit SHA across all five workflows (android, kotlin-jvm, python-ports, verify, prepare-authorized-release-artifacts) and added a top-level `permissions: { contents: read }` block to each. The publish workflow is the only one that requests `id-token: write` + `attestations: write`, and only on its single job. See `docs/HARDENING_FINDINGS_V1.0.md`.
- Added `.github/workflows/security-pipeline.yml` covering SBOM (SPDX + CycloneDX), Trivy filesystem and rootfs scans (SARIF → Security tab), `safety` Python dependency audit, `gitleaks` secret detection, `actionlint` + `yamllint` + `markdownlint-cli2` lint, OIDC token reachability probe, cosign keyless-signature reachability probe, and SHA-256 pinning of every conformance vector file.
- Hardened the existing reproducibility scripts in `android.yml` and `kotlin-jvm.yml`: switched to per-run `$RUNNER_TEMP` directories, added `set -euo pipefail`, asserted exactly-one-AAR with `find ... | wc -l`, and exported `SOURCE_DATE_EPOCH` for stable zip metadata.
- Added `ecosystems/android/gradle.properties` enabling build cache, parallel execution, and reproducible file timestamps; added `ecosystems/android/local.properties.example` and verified `local.properties` is already in `.gitignore`.
- Added `.yamllint.yml`, `.markdownlint-cli2.yaml`, and `.pre-commit-config.yaml` for local and CI lint consistency.
- Fixed two Kotlin compile errors in `SafePathResolverAndroid.kt` (missing closing parens on lines 58 + 60; replaced Java `?:` ternary on lines 156-161 with idiomatic Kotlin `if/else`). The file now compiles; the conformance runner is unblocked.
- Wired cosign keyless signing (OIDC-bound) and SLSA Level-3 provenance into `prepare-authorized-release-artifacts.yml`. Downstream consumers verify with `cosign verify-blob` and `gh attestation verify`.
- Re-added the dropped `windows-latest / Python 3.12` cell to `python-ports.yml` (the upstream setup-python archive-extraction bug is fixed in setup-python ≥ v5.1.0).
- Deleted three untracked scratch files (`.github/workflows/android.yml.bak/.fixed/.org`) that would have been misinterpreted as workflows by GitHub if ever committed.

### Atomic Batch File Transaction / Safe Multi-File Commit v0.1

- Added deterministic bounded batch planning for create, replace, and delete operations.
- Added root containment, duplicate-destination rejection, preflight checks, staging, rollback attempts, and explicit recovery-required states.
- Added capability seams for filesystem mutation, identity, clock, and test failure injection.
- Added ABT1 SHA-256 integrity-protected immutable receipts with bounded parsing.
- Added privacy-safe bounded diagnostics and explicit guarantee/durability levels.
- Hardened absolute-root enforcement, proof-gated `strong-local` atomicity, and truthful post-cleanup rollback availability reporting.

### File Lease / Advisory Lock v0.1 — corrective hardening

- Hardened stale-recovery ownership so an old lease cannot renew after a successor acquires the lock.
- Hardened orphan-lock recovery to fail closed when no valid owner record exists.
- Hardened release so an unexpected lock-directory entry cannot produce a false successful release.
- Added cross-platform regression coverage and package test-gate integration.

### Bounded File Content Reader / Safe Content Access v0.1

- Added the bounded file content reader implementation and deterministic UTF-8/text policies.
- Added bounded binary/text reads, offsets, EOF semantics, chunked streaming, cancellation, deadlines, and work budgets.
- Added Safe Path Resolver anchoring and explicit symlink policies.
- Added capability/data separation, cleanup guarantees, mutation consistency checks, and privacy-safe diagnostics.

### Release Verification — Bounded File Content Reader / Safe Content Access v0.1

- PR #94 merged to `main` at `277cb8f4d1e8278fe31c8dc7d3269c5c9bbeee99` after cross-platform pre-merge Verify #693.
- Pre-merge matrix passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, 661/661 tests, and browser smoke.
- Mainline verification required a fresh macOS runner after a transient test-runner hang; the fresh attempt passed all gates.

### Host Identity / Environment Fingerprint v0.1

- Added privacy-first local host identity and environment fingerprinting.
- Added stable/volatile field separation and deterministic SHA-256 identity.
- Added explicit capability seams for platform, runtime, path semantics, clock, serialization, hashing, and opt-in environment data.
- Added sensitive environment-name rejection and bounded allowlists.
- Added immutable fingerprints, comparison semantics, canonical serialization, and tamper detection.
- Added cross-platform contract tests and runnable example.
