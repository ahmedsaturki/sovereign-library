# Sovereign Library — Governance & Standing Decisions

> Authoritative home for standing governance decisions, non-negotiable engineering constraints, distribution policy, and supersession history. Part of the permanent project memory.

## Permanent constraints

1. **Additive evolution is the default.** Prefer `ADD -> EXTEND -> HARDEN -> IMPROVE -> SUPERSEDE -> DEPRECATE -> ARCHIVE -> DEFER` before deletion or silent replacement.
2. **No silent replacement.** Preserve compatibility or record migration when APIs, Cubes, Products, contracts, tests, documentation, or architecture evolve.
3. **Preserve shared history.** Never force-push or rewrite pushed history.
4. **Protect security boundaries.** Never invent credentials, expose secrets, disable guards, or weaken validation to satisfy tests.
5. **Protect frozen/released work.** Released/frozen components require a dedicated authorized maintenance task before modification.
6. **CI is evidence, not authorization.** Green CI does not by itself authorize a release or publication.
7. **Persist important work.** A meaningful milestone is not complete while important work exists only locally.

## Architecture law

`INDEPENDENT CUBES -> EXPLICIT COMPOSITION -> REAL PRODUCTS`

A suitable Cube should be independently usable, testable, packageable, versionable, distributable, secure, documented, and free of hidden monorepo runtime coupling.

Multi-ecosystem model:

`ONE AUTHORITATIVE CONTRACT -> NATIVE IMPLEMENTATION PER ECOSYSTEM -> CONFORMANCE -> INDEPENDENT DISTRIBUTION`

Targets include Node.js, Python, Kotlin/JVM, Android/Kotlin, and iOS/Apple platforms where justified. Not every Cube needs every ecosystem.

## Distribution policy — CURRENT

**GITHUB IS CANONICAL. FREE ECOSYSTEM REGISTRIES ARE OPTIONAL.**

GitHub is the canonical source, persistent project memory, release-evidence home, and default distribution channel.

GitHub Releases, release assets, checksums, integrity records, documentation, and reproducible artifacts are the standard release path.

A free native ecosystem registry may be enabled for a specific release wave only when it is genuinely free for the intended workload, technically appropriate, secure, reproducible, and explicitly selected for that wave.

Possible optional channels include npm, PyPI, Maven-compatible registries/Maven Central, GitHub Packages, JSR, and other appropriate ecosystem-native services subject to their current terms and limits.

No paid registry or mandatory third-party service is required.

Do not publish merely because a package is technically ready. Release timing and channel selection are separate controls.

## Historical supersession

Earlier repository wording that prohibited external registries absolutely is **SUPERSEDED** by the current policy above. The historical wording remains preserved in prior records and is not deleted.

Current decision:

`GITHUB CANONICAL + FREE REGISTRIES OPTIONAL`

## Release state

The first two candidates are authorized in principle but publication is deferred while the library-packaging wave continues:

- `@sovereign/safe-path-resolver@0.1.0`
- `@sovereign/runtime-capability-inspector@0.1.0`

They are not `RELEASED` until an actual GitHub release/artifact distribution event is created and verified.

Future controlled path:

`FINAL CLEAN VERIFY -> PACKAGE -> GITHUB RELEASE -> OPTIONAL FREE REGISTRY RELEASES -> POST-DISTRIBUTION VERIFY -> FREEZE`

## Branch governance

- PR #111 remains **OPEN / UNMERGED / PARKED** until explicitly reclassified.
- Do not merge it as a side effect of unrelated work.
- Do not push directly to `main` for substantive changes; use a reviewed PR.
- Never force-push a shared branch.

## Continuity

For every meaningful change:

`CHANGE -> TEST -> DOCUMENT -> COMMIT -> PUSH -> VERIFY REMOTE`

`PROJECT_CONTROL.md` is the authority for current state, active task, blockers, and recovery point.
`AGENTS.md` is the agent entry point.
Chat history is supplemental only.

When a standing decision changes:

`OLD DECISION -> WHY -> NEW DECISION -> EFFECTIVE STATE`

Never erase the old decision; mark it superseded.
