# Sovereign Library — Phase 2 Release-Engineering Hardening

**Status:** Phase-2 hardening wave landed on `feat/continuity-hardening`
HEAD `1ca7b80+`. Twenty enterprise-grade capabilities are now wired in
on top of Phase-1 (supply-chain hardening, OIDC, SLSA, cosign).

**Phase-2 capacity inventory:**

| # | Capability                  | Surface                                                          |
|---|-----------------------------|------------------------------------------------------------------|
| 1 | Multi-region CI             | `.github/workflows/release-engineering.yml` `multi-region-ci` job |
| 2 | E2E (BrowserStack/SauceLabs)| `scripts/e2e-cloud.mjs`, opt-in via secrets                       |
| 3 | Performance regression      | `scripts/perf-bench.mjs`, `scripts/perf-compare.mjs`              |
| 4 | Dependabot auto-merge       | `.github/dependabot-auto-merge.yml`                              |
| 5 | Release notes automation    | `scripts/release-notes.mjs`, `docs/RELEASE_NOTES_TEMPLATE.md`    |
| 6 | Changelog generation        | `scripts/changelog.mjs`, `CHANGELOG_TEMPLATE.md`                 |
| 7 | DB migrations               | `scripts/migrate.mjs`, `migrations/sqlite/*.sql`                 |
| 8 | API versioning              | `scripts/api-version.mjs`                                        |
| 9 | Backward-compat testing     | `scripts/backward-compat.mjs`                                    |
|10 | Feature flags               | `scripts/feature-flags.mjs`, `ci/feature-flags/flags.json`       |
|11 | Canary deployment           | `scripts/deploy-plan.mjs --strategy canary`                      |
|12 | Progressive rollout         | `scripts/deploy-plan.mjs --strategy progressive`                 |
|13 | Blue-green deployment       | `scripts/deploy-plan.mjs --strategy blue-green`                  |
|14 | Rollback automation         | `scripts/rollback.mjs`                                           |
|15 | Chaos engineering           | `scripts/chaos.mjs`, `deploy/chaos/` (Litmus / Chaos Mesh)       |
|16 | Load testing (k6)           | `ci/load/k6/smoke.js`                                            |
|17 | Load testing (Locust)       | `ci/load/locustfile.py`                                          |
|18 | SAST / DAST / dep scan      | `.github/workflows/security-pipeline.yml` + `release-engineering`|
|19 | License compliance (FOSSA)  | `.fossa.yml`, `release-engineering` `fossa-license-scan` job     |
|20 | SBOM + container signing    | `release-engineering` `sbom-release` + `cosign-image-sign` jobs  |
|   | *(also)* Dependabot config  | `.github/dependabot.yml`                                         |

## What was added

### Top-level files

- `.github/workflows/release-engineering.yml` — the Phase-2 aggregator workflow.
- `.github/dependabot.yml` — npm + github-actions + pip weekly bumps, grouped
  for review surface reduction.
- `.github/dependabot-auto-merge.yml` — gated merge bot: only patch / minor
  bumps, never on frozen cubes, never on major bumps.
- `.fossa.yml` — license compliance configuration. Allow-list:
  Apache-2.0, MIT, BSD-2/3, ISC, CC0-1.0, Unlicense, MPL-2.0,
  EPL-1.0/2.0, CDDL-1.0, LGPL-2.1/3.0. Deny: GPL-2/3, AGPL-3.0,
  SSPL-1.0, BUSL-1.1, Commons-Clause.
- `docs/RELEASE_NOTES_TEMPLATE.md` — release-notes rendering template.
- `CHANGELOG_TEMPLATE.md` — changelog rendering template.
- `docs/PHASE2_HARDENING.md` — this file.

### Scripts under `scripts/`

- `scripts/parse-args.mjs` — shared flag-aware argument parser.
- `scripts/api-version.mjs` — semver contract evaluator.
- `scripts/backward-compat.mjs` — diff vs previous release tag.
- `scripts/feature-flags.mjs` — local flag evaluator (LD-style contract).
- `scripts/migrate.mjs` — generic SQL migration runner (SQLite default).
- `scripts/chaos.mjs` — hermetic chaos probes (process-kill, network-failure,
  disk-full, clock-jump, signal-storm).
- `scripts/perf-bench.mjs` — micro-bench harness for representative cubes.
- `scripts/perf-compare.mjs` — baseline-vs-current regression detector.
- `scripts/deploy-plan.mjs` — canary / progressive / blue-green plan emitter.
- `scripts/rollback.mjs` — deterministic rollback plan emitter.
- `scripts/changelog.mjs` — Conventional-Commits bucketed changelog.
- `scripts/release-notes.mjs` — release-notes rendering from template.
- `scripts/generate-sbom.mjs` — per-package SBOM digest.
- `scripts/phase2-summary.mjs` — Phase-2 evidence index.
- `scripts/e2e-cloud.mjs` — BrowserStack / SauceLabs capability probe.

### Configuration under `ci/`

- `ci/chaos/suite.json` — probe list.
- `ci/feature-flags/flags.json` — flag definitions.
- `ci/deploy/manifest.json` — deployment manifest.
- `ci/baselines/perf.baseline.json` — pinned perf baselines.
- `ci/load/k6/smoke.js` — k6 smoke script.
- `ci/load/locustfile.py` — Locust smoke script.

### Migrations

- `migrations/sqlite/001-initial-schema.sql` + `.down.sql` — reference
  forward + reverse migration. Sovereign cubes do not currently share
  a database; the tooling is provided as a reusable capability for
  downstream products.

### Live-cluster chaos runbooks

- `deploy/chaos/README.md` — why live-cluster chaos is NOT triggered
  from CI.
- `deploy/chaos/runbook-pod-kill.md` — pod-kill chaos playbook.
- `deploy/chaos/runbook-network-partition.md` — network-partition playbook.
- `deploy/chaos/litmus-experiments/pod-kill.yaml` — Litmus pod-kill manifest.
- `deploy/chaos/chaos-mesh-experiments/network-partition.yaml` —
  Chaos Mesh network-partition manifest.

### Tests

- `tests/phase2/*.test.mjs` — 14 unit tests covering the new scripts.
  Wired via `npm run test:phase2` and included in `npm run verify`.

## Run evidence

```text
$ npm run test:phase2
ℹ tests 14
ℹ pass 14
ℹ fail 0

$ node scripts/api-version.mjs --catalog scripts/package-catalog.json --out .hermes/phase2/api-version.json
api-version: 87/87 packages valid

$ node scripts/chaos.mjs --suite ci/chaos/suite.json --out .hermes/phase2/chaos.json
chaos: ok=5 failed=0 skipped=0

$ node scripts/perf-bench.mjs --out .hermes/phase2/perf.json --label phase2-final
perf-bench: 4 benches

$ node scripts/perf-compare.mjs --current .hermes/phase2/perf.json --baseline ci/baselines/perf.baseline.json --threshold 1.20 --out .hermes/phase2/perf.diff.json
perf-compare: 4/4 within 1.2x; regressions=0

$ node scripts/changelog.mjs --since HEAD~500 --until HEAD --out .hermes/phase2/changelog.md
changelog: 635 commits

$ node scripts/deploy-plan.mjs --strategy canary --manifest ci/deploy/manifest.json --out .hermes/phase2/deploy-plan.json
deploy-plan: strategy=canary steps=4

$ node scripts/rollback.mjs --manifest ci/deploy/manifest.json --out .hermes/phase2/rollback.json
rollback: 7 steps

$ node scripts/migrate.mjs --migrations migrations/sqlite --target sqlite::memory: --dry-run --out .hermes/phase2/migrations.json
migrate: total=1 pending=1 errors=0 (dry-run=true)
```

## What was NOT added

Per AGENTS.md / GOVERNANCE.md / PROJECT_CONTROL.md:

- **No `main` history rewrite.** All Phase-2 work is additive on the
  existing branch.
- **No new dependency.** Every Phase-2 script uses Node 24 stdlib only.
- **No modifications to frozen cubes.** Frozen cubes per
  `PROJECT_CONTROL.md` (application-lifecycle, process-supervisor,
  filesystem-recovery-journal, safe-file-quarantine-delete, bounded-file-
  content-reader-safe-content-access, filesystem-permission-ownership-
  descriptor-v0-1, atomic-batch-file-transaction-safe-multi-file-commit,
  file-lease-advisory-lock) are not touched by Phase-2.
- **No destructive replacement.** Phase-1 artifacts (security-pipeline.yml,
  conformance vector pinning, FOSSA SBOM) remain authoritative; Phase-2
  augments them.
- **No live-cluster chaos from CI.** Per AGENTS.md, any action that
  affects external systems requires explicit authorization.

## Decisions encoded

- **Auto-merge policy:** patch / minor only, no major bumps, no
  touches to frozen cubes, required CI checks must be green, no
  `do-not-merge` label, no unresolved review threads.
- **FOSSA policy:** Apache-2.0 strict allow-list; GPL-family and SSPL
  hard-denied; BUSL and Commons-Clause hard-denied.
- **Canary abort criteria:** error rate >1%, p99 latency >2s. Same
  thresholds apply to all three rollout strategies.
- **Chaos probe hermeticity:** every probe must run in-process so CI is
  deterministic. Live-cluster chaos is operator-triggered only.
- **Feature flag contract:** env / phase / cubes (glob) / pr booleans,
  first-match wins, `default` is the fallback. The contract is
  LaunchDarkly-compatible; swapping in a hosted service requires
  replacing only the rule engine.