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
- Browser smoke: real Chromium smoke test passes on the supported matrix.

## CI evidence

- Baseline verification: **Verify Run #835** passed Ubuntu, Windows, and macOS-15-Intel.
- Publication-guard extension: **Verify Run #837** added and exercised the explicit publication guard.
- Final pre-authorization verification: **Verify Run #845** at commit `f14bbd9229fcda23f00602cfc9288881c61e213e` completed with **SUCCESS** on Ubuntu, Windows, and macOS-15-Intel.
- Run #845 covered the complete matrix on all three platforms: syntax, bounded contract/integration tests, declaration pilot, package tooling, reproducible packaging, security boundaries, publication guard, and real browser smoke.

## Publication guard invariants

Before explicit release authorization, the repository must continue to satisfy all of the following:

1. The root repository package remains private.
2. Public candidate packages contain no `publishConfig`.
3. No GitHub Actions workflow contains `npm publish`.
4. No repository configuration injects npm registry credentials or overrides the registry.
5. Candidate packages contain no runtime dependency declarations for the first zero-runtime-dependency batch.
6. Candidate packages ship no package scripts.

## Release readiness decision

**TECHNICAL READINESS: VERIFIED.**

The release-readiness gate is complete. The repository is now **READY FOR EXPLICIT RELEASE AUTHORIZATION**.

This record does not itself authorize npm publication. Authorization remains a separate governance decision.

## Release sequence

`API Boundary -> Declaration -> Package Contract -> Package Tooling -> Reproducible Pack -> Security -> Publication Guard -> Cross-platform CI -> Release Authorization -> Publish`

The final two actions are deliberately separate. CI success establishes technical readiness; release authorization is a separate governance decision.
