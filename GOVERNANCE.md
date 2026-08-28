# Sovereign Library — Governance & Standing Decisions

> Authoritative home for standing governance decisions, non-negotiable engineering constraints,
> distribution policy, and supersession history. This file is part of the permanent project memory.
>
> **Repository state remains authoritative over chat.** Historical decisions are preserved; when
> a decision changes, record the newer decision and mark the older one SUPERSEDED rather than
> deleting it.

## 1. Permanent engineering constraints

1. **Additive evolution is the default.** Prefer `ADD -> EXTEND -> HARDEN -> IMPROVE ->
   SUPERSEDE -> DEPRECATE -> ARCHIVE -> DEFER` before deletion or silent replacement.
2. **Do not silently replace** APIs, Cubes, Products, contracts, tests, documentation, or
   architectural decisions. Preserve compatibility or record the migration.
3. **Do not rewrite shared history.** No force-pushes and no history rewriting on shared branches.
4. **Do not bypass security boundaries.** Never invent credentials, expose secrets, disable guards,
   or weaken validation to satisfy tests.
5. **Do not modify released/frozen components** without a dedicated authorized task.
6. **Do not treat CI success as release authorization.** Technical readiness and release timing
   are separate controls.
7. **Do not leave important work local-only.** Meaningful completed work must be persisted,
   committed, pushed, and reconciled on GitHub.

## 2. Architecture law

`INDEPENDENT CUBES -> EXPLICIT COMPOSITION -> REAL PRODUCTS`

Every suitable Cube is expected to be independently usable, testable, packageable,
versionable, distributable, and replaceable without hidden monorepo runtime coupling.

Multi-ecosystem model:

`ONE AUTHORITATIVE CONTRACT -> NATIVE IMPLEMENTATION PER ECOSYSTEM -> CONFORMANCE ->
INDEPENDENT DISTRIBUTION`

Target ecosystems include Node.js, Python, Kotlin/JVM, Android/Kotlin, and iOS/Apple platforms
where justified. Do not claim an implementation exists where it does not.

## 3. Distribution policy — CURRENT

**GitHub is the canonical source, project-memory, release-evidence, and default distribution
channel.**

Free native ecosystem registries are **OPTIONAL**, not mandatory. A registry may be used for a
specific release wave only when it is genuinely free for the intended workload, technically
appropriate, secure, reproducible, and explicitly enabled for that wave.

Examples that may be considered when appropriate:

- Node.js: npm, GitHub Packages, JSR
- Python: PyPI
- Kotlin/JVM / Android: Maven-compatible registries or Maven Central
- iOS: Git-based Swift Package distribution

No paid registry or mandatory third-party service is required by the architecture.

Do not publish merely because a package has a manifest. Evaluate the value and operational cost
of each distribution channel. GitHub Releases remain the canonical release-artifact mechanism.

## 4. Historical distribution decision — SUPERSEDED

Earlier repository wording declared **GitHub-only** and prohibited all external registries.
That wording is preserved as historical context but is **SUPERSEDED** by Section 3.

The superseding decision is:

`GITHUB CANONICAL + FREE REGISTRIES OPTIONAL`

No historical record is deleted because of this change.

## 5. Release authorization and timing

The first two authorized candidates are:

- `@sovereign/safe-path-resolver@0.1.0`
- `@sovereign/runtime-capability-inspector@0.1.0`

The owner has authorized them **in principle**, but publication is currently **deferred by
project policy while library work continues**. They are not to be marked `RELEASED` until a
real GitHub Release artifact has been created and verified.

Current controlled future release path:

`FINAL CLEAN VERIFY -> PACKAGE -> GITHUB RELEASE -> OPTIONAL FREE REGISTRY RELEASES ->
POST-DISTRIBUTION VERIFY -> FREEZE`

## 6. PR / branch governance

- PR #111 remains **OPEN / UNMERGED / PARKED** until explicitly reclassified.
- Do not merge PR #111 as a side effect of unrelated work.
- Do not push directly to `main` for substantive changes; use reviewed PRs.
- Never force-push a shared branch.

## 7. Frozen/released work

Released/frozen Cubes are immutable evidence. Any change requires its own explicit authorized
maintenance task, including test-only changes that alter release behavior or evidence.

## 8. Continuity

For every meaningful change:

`CHANGE -> TEST -> DOCUMENT -> COMMIT -> PUSH -> VERIFY REMOTE`

At the end of a task, `PROJECT_CONTROL.md` must identify the current state, completed work,
remaining work, blockers, and next task. Chat history is supplemental only.

## 9. Supersession record

When a standing decision changes:

`OLD DECISION -> WHY -> NEW DECISION -> EFFECTIVE STATE -> COMPATIBILITY / MIGRATION`

Never erase the previous decision; mark it SUPERSEDED and point to the new one.
