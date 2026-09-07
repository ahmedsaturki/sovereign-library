# Sovereign Library — Continuity-Hardening Audit & Runbook v1.0

> Authoritative Staff-Engineer deep-dive audit for the `feat/continuity-hardening`
> branch. This document is the cumulative evidence record for the security /
> supply-chain / reproducibility hardening wave.

## Scope of audit

- `.github/workflows/` — every workflow YAML (android, kotlin-jvm, python-ports,
  verify, prepare-authorized-release-artifacts).
- `ecosystems/android/` — root `build.gradle`, `settings.gradle`, `local.properties`,
  gradle wrapper, `safe-path-resolver` and `conformance` module build files,
  Kotlin source under both modules.
- `contracts/conformance/` — vector JSON files and README.
- `contracts/CUBE_CONTRACT_V1.md`, `contracts/policy-decision-v0.1.md`.
- `docs/` — release / governance / constitution references that bind the work.

## Method

1. Read every file end-to-end; do not trust claims in the latest commit message.
2. Map each finding to: severity, location, root cause, minimal fix.
3. Apply fixes additively. No silent replacement, no history rewrite.
4. After each change, run a syntactic check (YAML / Gradle / Kotlin) and
   capture the result.
5. Persist everything to the branch and push, then verify the remote HEAD
   matches the local HEAD.

## Severity model

| Sev | Meaning |
|-----|---------|
| CRITICAL | Security boundary or supply-chain break; release-blocking. |
| HIGH     | Reproducibility / durability failure; CI cannot guarantee evidence. |
| MEDIUM   | Missing hardening (caching, OIDC, SBOM, lint) — degrades but does not break. |
| LOW      | Doc / cosmetic / lint nits. |
