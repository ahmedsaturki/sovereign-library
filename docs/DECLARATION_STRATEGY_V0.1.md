# Sovereign Library — TypeScript Declaration Strategy v0.1

## Decision

The repository remains JavaScript-first. Public package types will be produced incrementally from JSDoc rather than by rewriting the runtime into TypeScript.

## Goals

- Preserve the current zero-runtime-dependency model.
- Keep runtime source in `.js`.
- Make public API contracts explicit and reviewable.
- Emit `.d.ts` only from the frozen public surface.
- Reject accidental declaration of test helpers, internal functions, and capability implementation details.

## Strategy

1. Add `@ts-check` / targeted JSDoc only where the public contract needs stronger type information.
2. Use a repository-level `jsconfig.declarations.json` as the single declaration compiler contract.
3. Enable `allowJs`, `checkJs`, `declaration`, `emitDeclarationOnly`, `declarationMap`, `strict`, and `skipLibCheck`.
4. Generate declarations into an ignored staging directory; package-specific `types` entries will be introduced later by the package contract gate.
5. Do not add TypeScript to runtime dependencies.
6. Use pilot validation before expanding to all public candidates.

## Pilot candidates

The first declaration pilots are:

1. `safe-path-resolver-containment-boundary`
2. `runtime-capability-inspector`

These were selected because their public functions are already explicit, deterministic, and comparatively small, while their capability seams exercise the type boundary that will matter to later packages.

## Public-surface rules

- Only exports listed in `docs/PUBLIC_API_BOUNDARY_V0.1.md` may be treated as package API.
- Unlisted exports are internal by default and must not be promoted implicitly by generated declarations.
- Error classes and stable format/constant exports are public only when explicitly listed.
- Capability objects are typed as injected executable seams, not as arbitrary plain-data configuration.
- Serialized payloads remain data-only and immutable at the public boundary.
- Node built-in types may be referenced in generated declarations where unavoidable; they do not become runtime package dependencies.

## Compatibility policy

- Runtime baseline remains Node 24+.
- Declaration output must be consumable by TypeScript consumers without requiring source JSDoc at install time.
- Declaration generation must be deterministic for the same source tree.
- Declaration generation is a packaging concern; it does not authorize npm publication.

## Non-goals

- No full TypeScript migration.
- No package publication.
- No synchronized package versioning decision.
- No generated declarations for incubating or experimental cubes.
- No public API expansion during declaration generation.

## Gate

This strategy is complete only after:

`config valid -> pilot source annotated -> declaration emit succeeds -> generated surface matches API manifest -> cross-platform CI passes`

Only then may the project enter package contract/tooling work.
