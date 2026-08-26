# Sovereign Library — Public Package Release Authorization Packet v0.1

## Status

**READY FOR EXPLICIT RELEASE AUTHORIZATION — NOT AUTHORIZED FOR PUBLICATION**

This packet records the evidence required before the first small public package batch may be published. Technical readiness is complete; publication remains a separate governance action.

## Candidates

1. `@sovereign/safe-path-resolver` v0.1.0
2. `@sovereign/runtime-capability-inspector` v0.1.0

## Evidence baseline

- Mainline evidence commit: `f14bbd9229fcda23f00602cfc9288881c61e213e`
- Final pre-authorization verify run: **#845** (`32958492048`)
- Cross-platform result: **SUCCESS** on Ubuntu, Windows, and macOS-15-Intel.
- Declaration pilot: PASS on all three platforms.
- Package tooling verification: PASS on all three platforms.
- Reproducible package verification: PASS on all three platforms.
- Security boundary verification: PASS on all three platforms.
- Publication Guard: PASS on all three platforms.
- Real browser smoke: PASS on all three platforms.

## Package contract evidence

- Apache License 2.0 is authoritative.
- Node.js baseline: `>=24`.
- Runtime third-party dependencies: none for the first batch.
- Public API is restricted to the frozen boundary in `docs/PUBLIC_API_BOUNDARY_V0.1.md`.
- `exports` maps are explicit and deny undeclared deep-import API exposure.
- Generated declarations are exposed through the root `types` entry.
- Package scripts are absent.
- `publishConfig` is absent.

## Publication Guard evidence

The guard verifies that, before explicit authorization:

- the root repository package remains private;
- no `npm publish` command exists in repository automation/configuration;
- no npm registry credentials are injected;
- no registry override is configured;
- no package `publishConfig` exists;
- no runtime dependency declarations exist for the zero-runtime-dependency batch;
- no package scripts ship with the public candidates.

## Authorization boundary

Technical CI success does **not** itself authorize publication.

The following actions remain prohibited until an explicit release-authorization decision is recorded:

- npm organization creation or reservation
- npm token configuration
- npm registry automation
- `npm publish`
- GitHub Packages publication
- public release announcements
- package adoption claims

## Release decision

**Current decision: READY — WAITING FOR EXPLICIT RELEASE AUTHORIZATION.**

Once explicit authorization exists, the next controlled sequence is:

`AUTHORIZED -> FINAL CLEAN VERIFY -> TAG/RELEASE -> PUBLISH -> POST-PUBLISH VERIFY -> FREEZE`

No publication action is embedded in this packet.
