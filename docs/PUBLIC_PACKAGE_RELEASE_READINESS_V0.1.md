# Sovereign Library — Public Package Release Readiness v0.1

## Scope

This record covers the first two package candidates:

- `@sovereign/safe-path-resolver` v0.1.0
- `@sovereign/runtime-capability-inspector` v0.1.0

This is a release-readiness record. It does **not** authorize npm publication.

## Verified gates

- Public API boundary freeze: verified across Ubuntu, Windows, and macOS-15-Intel.
- Declaration pilot: exact generated public export surfaces verified for both candidates.
- Package contract: frozen in `docs/PACKAGE_CONTRACT_V0.1.md`.
- Package tooling: manifests, `exports`, declaration staging, tarball file boundaries, and npm pack checks verified across the supported matrix.
- Reproducible packaging: two clean packaging passes produce byte-identical tarballs for both candidates, with integrity, shasum, and file-manifest agreement.
- Security boundary: forbidden dynamic execution, shell-oriented child-process execution, and public-package dependency boundary checks pass.
- Publication guard: repository/package configuration is explicitly checked to remain publication-disabled until a later release authorization.
- Browser smoke: real Chromium smoke test remains part of the same cross-platform verification matrix.

## CI evidence

The latest completed baseline before the publication-guard extension is **Verify Run #835**, which passed all three platforms with the reproducibility, security, and browser gates green.

The publication-guard extension is being verified by the current mainline run **#837** at commit `9e2ca35668e5ad2923a8c6c6c4992483a07b181d`. Ubuntu has already passed the full matrix including the publication guard; Windows and macOS are still completing the same matrix at the time of this record update.

## Publication guard invariants

Before explicit release authorization, the repository must continue to satisfy all of the following:

1. The root repository package remains private.
2. Public candidate packages contain no `publishConfig`.
3. No GitHub Actions workflow contains `npm publish`.
4. No repository configuration injects npm registry credentials or overrides the registry.
5. Candidate packages contain no runtime dependency declarations for the first zero-runtime-dependency batch.
6. Candidate packages ship no package scripts.

## Release sequence

`API Boundary -> Declaration -> Package Contract -> Package Tooling -> Reproducible Pack -> Security -> Publication Guard -> Cross-platform CI -> Release Authorization -> Publish`

The final two actions are deliberately separate. CI success establishes technical readiness; release authorization is a separate governance decision.
