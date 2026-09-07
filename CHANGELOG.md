# Changelog

## Unreleased

### Phase-2 Release-Engineering Hardening (feat/continuity-hardening)

Twenty enterprise-grade capabilities layered on top of Phase-1 (supply-chain hardening, OIDC, SLSA, cosign). See `docs/PHASE2_HARDENING.md` for the full inventory and run evidence.

#### Workflows
- Added `.github/workflows/release-engineering.yml` (24 jobs across 7 capability areas).
- Added `.github/dependabot-auto-merge.yml` gated by semver deltas, frozen-cube denylist, and required CI checks.
- Added `.github/dependabot.yml` weekly bumps across npm, github-actions, pip; grouped for review surface reduction.

#### Scripts (Node-24 stdlib only — no new dependencies)
- `scripts/parse-args.mjs` — shared flag-aware argument parser.
- `scripts/api-version.mjs` — semver contract evaluator (87/87 packages valid against current catalog).
- `scripts/backward-compat.mjs` — git-diff export-surface comparison vs base ref.
- `scripts/feature-flags.mjs` — LaunchDarkly-compatible rule engine (no SDK).
- `scripts/migrate.mjs` — generic SQL migration runner (SQLite in-memory default; persistent targets supported).
- `scripts/chaos.mjs` — hermetic chaos probes (process-kill, network-failure, disk-full, clock-jump, signal-storm).
- `scripts/perf-bench.mjs` / `scripts/perf-compare.mjs` — micro-bench + threshold-based regression detector.
- `scripts/deploy-plan.mjs` — canary / progressive / blue-green plan emitter.
- `scripts/rollback.mjs` — deterministic 7-step rollback plan emitter.
- `scripts/changelog.mjs` — Conventional-Commits bucketed changelog (635 commits classified in CI smoke).
- `scripts/release-notes.mjs` — release-notes rendering from `docs/RELEASE_NOTES_TEMPLATE.md`.
- `scripts/generate-sbom.mjs` — per-package SBOM digest with deterministic sha256.
- `scripts/phase2-summary.mjs` — Phase-2 evidence index.
- `scripts/e2e-cloud.mjs` — BrowserStack / SauceLabs capability probe.

#### Configuration
- `ci/chaos/suite.json`, `ci/feature-flags/flags.json`, `ci/deploy/manifest.json`, `ci/baselines/perf.baseline.json`.
- `ci/load/k6/smoke.js`, `ci/load/locustfile.py`.
- `.fossa.yml` — Apache-2.0 strict allow-list; GPL-family, AGPL, SSPL, BUSL, Commons-Clause denied.
- `migrations/sqlite/001-initial-schema.sql` + `.down.sql` — reference forward + reverse migration.

#### Live-cluster chaos runbooks (operator-triggered only)
- `deploy/chaos/README.md`, `runbook-pod-kill.md`, `runbook-network-partition.md`.
- `deploy/chaos/litmus-experiments/pod-kill.yaml`, `deploy/chaos/chaos-mesh-experiments/network-partition.yaml`.

#### Tests
- `tests/phase2/*.test.mjs` — 14 unit tests for the new scripts. Wired via `npm run test:phase2` and included in `npm run verify`.
- `package.json` gained `"test:phase2"` and an extended `"verify"` script. **No existing scripts were removed.**

#### Documentation
- `docs/PHASE2_HARDENING.md` — capability inventory + run evidence.
- `docs/RELEASE_NOTES_TEMPLATE.md`, `CHANGELOG_TEMPLATE.md`.

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
