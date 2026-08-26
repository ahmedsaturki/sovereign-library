# Sovereign Library — Package Contract v0.1

## Purpose

Define the public npm package contract for the first small batch of Sovereign Library primitives before any package generation, registry organization work, changesets, API Extractor baseline, or publication.

This document is a packaging contract, not a publication authorization.

## Scope

Initial candidates are the eight APIs frozen in `docs/PUBLIC_API_BOUNDARY_V0.1.md`:

1. `@sovereign/safe-path-resolver`
2. `@sovereign/glob-path-matcher`
3. `@sovereign/filesystem-watcher`
4. `@sovereign/file-lease`
5. `@sovereign/atomic-file-writer`
6. `@sovereign/ephemeral-workspace`
7. `@sovereign/directory-snapshot`
8. `@sovereign/runtime-capability-inspector`

Names are reserved contract candidates only. No npm organization or registry claim is implied by this document.

## Naming and versioning

- Scope: `@sovereign`.
- Package names are stable identifiers once the package contract is frozen.
- Versioning is independent per package.
- First publishable version for a candidate is expected to begin at `0.1.0` unless a later release record explicitly chooses otherwise.
- Semver semantics apply; breaking public API or serialization-contract changes require a new major version once a package reaches 1.0.

## Runtime compatibility

- Supported runtime baseline: Node.js 24 LTS.
- No runtime third-party dependencies are permitted for the first batch unless an explicit versioned exception is approved.
- Build, declaration, packaging, security, and release tooling are development-only dependencies.
- Browser/browser-runtime support is not implied by these packages unless a candidate's own contract explicitly states it.

## Module and entry-point policy

- Source is JavaScript-first and remains source-compatible with Node ESM.
- Public package entry points expose only the symbols frozen in `docs/PUBLIC_API_BOUNDARY_V0.1.md`.
- `exports` maps are mandatory and must block undeclared deep imports.
- The primary public entry is `.`.
- Generated declarations are exposed through the package `types` entry for the root export.
- No CommonJS compatibility layer is required for the first batch unless a concrete candidate proves a compatibility need before publish. Introducing CJS later is a deliberate compatibility decision, not an implicit package default.

## Type declaration policy

- `.d.ts` is generated from the JS/JSDoc source contract.
- Generated declarations are build artifacts, not hand-maintained source.
- Declarations must contain exactly the public export surface frozen by the API boundary manifest for the relevant candidate.
- Internal helpers and implementation-only symbols must not become reachable through the package root or documented subpaths.

## License and metadata

Every package must declare:

- `license`: `Apache-2.0`
- repository URL pointing to the Sovereign Library repository
- project homepage/readme link consistent with repository metadata
- `engines.node`: `>=24`
- `sideEffects`: `false` unless a later candidate-specific contract proves side effects that require otherwise

Package metadata must not contain credentials, environment values, local filesystem paths, or build-machine identifiers.

## Tarball boundary

The published tarball must contain only the artifacts required to consume and audit the package, including as applicable:

- compiled/source JS entry files required by the package contract
- generated `.d.ts`
- `README.md`
- `LICENSE`
- `NOTICE`
- package metadata
- mandatory provenance/release metadata selected by the later release gate

The tarball must exclude:

- tests and test fixtures
- repository-wide source outside the package boundary
- `.github/`
- `.git/`
- `.artifacts/`
- local caches
- temporary files
- secrets or environment files
- unrelated cubes
- development-only scripts unless explicitly part of the package runtime contract

## Export safety

- Root exports must match the frozen candidate contract exactly.
- Deep import paths are denied unless explicitly listed in the package contract.
- Package files outside the export map are not part of the API merely because they exist in the tarball.

## Reproducibility requirements

Before first publish, each candidate must prove:

1. deterministic package file selection
2. deterministic generated declaration output
3. deterministic package metadata
4. `npm pack --json` succeeds in a clean environment
5. two clean packaging runs produce equivalent package manifests and byte-for-byte equivalent package payloads where timestamp normalization permits
6. no undeclared dependency or file enters the tarball

## Security requirements

Before publication:

- `npm audit` and applicable dependency scanners must pass for production dependencies.
- package contents must be checked for secret-like values and private filesystem paths.
- export maps must be reviewed for accidental internal exposure.
- install/prepare lifecycle scripts are prohibited for the first batch unless explicitly justified and reviewed.

## Publication exclusions

This contract does not authorize:

- npm organization creation or reservation
- npm token configuration
- npm publication
- GitHub Packages publication
- public beta/release announcements
- package adoption claims

Those actions require later verified gates.

## Gate

`API Boundary -> Declaration Strategy -> Package Contract -> Package Implementation -> TEST -> FIX -> VERIFY -> Reproducible Pack -> Security -> Release -> Publish`

The contract itself is complete only after this document is merged and the control plane advances to the tooling task.
