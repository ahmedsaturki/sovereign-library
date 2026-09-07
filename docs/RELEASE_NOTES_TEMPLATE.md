# Release Notes — {{RELEASE_TAG}}

**Release date:** {{RELEASE_DATE}}
**Commit:** `{{RELEASE_SHA}}`

## Highlights

{{HIGHLIGHTS}}

## What's changed

See `CHANGELOG.md` for the full change log and per-package details.

## Verification

- ✅ Phase-2 release-engineering workflow green (multi-region CI, perf regression, chaos probes, FOSSA license compliance, SBOM).
- ✅ Phase-1 continuity-hardening artifacts present (cosign keyless signature, SLSA Level-3 provenance, OIDC tokens, conformance vector SHA-256 pinning).
- ✅ Dependency surface unchanged from the previous release unless explicitly listed in `Highlights`.

## Distribution

GitHub Releases is the canonical distribution channel. Optional free
ecosystem registries remain deferred per `GOVERNANCE.md`.

## Security

- SBOM (SPDX + CycloneDX) attached to this release as a workflow artifact.
- License compliance report (FOSSA) attached as SARIF.
- cosign keyless signature over the source archive: verify with
  `cosign verify-blob --signature <sig> <archive>` against the Fulcio
  certificate chain.

## Upgrade notes

No action required for consumers using the GitHub Releases artifacts.