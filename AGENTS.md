# Sovereign Library — Agent Operating Contract

This file is the mandatory entry point for AI coding agents, automation agents, and autonomous engineering tools operating in this repository, including Hermes, OpenCode, JCode, Codex, and equivalent tools.

## Read first

At the beginning of every task, read in this order:

1. `AGENTS.md` — agent operating rules.
2. `PROJECT_CONTROL.md` — authoritative current mission, governance, blockers, and recovery point.
3. `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md` — permanent architecture laws.
4. `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md` — project-wide map and document hierarchy.
5. `ROADMAP.md` — sequencing and future direction.
6. Relevant SPEC, API boundary, package contract, tests, and release records.

Never use conversation memory as a substitute for repository evidence.

## Source-of-truth hierarchy

When information conflicts, use this precedence:

1. GitHub repository state (refs, commits, PRs, CI, releases) for actual repository state.
2. `PROJECT_CONTROL.md` for current execution, governance, blockers, and recovery.
3. Relevant SPEC for behavioral semantics.
4. Architecture Constitution for permanent architecture and independence principles.
5. Package/API contract documents for package boundaries.
6. Release records for release execution and evidence.
7. README and other explanatory docs.
8. Conversation context only as supplemental intent, never authoritative project state.

Historical records remain historical. Never rewrite history merely to make the current state look cleaner.

## Engineering loop

For every authorized change:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Do not skip failure-path testing or verification merely because the happy path works.

## Sovereign Independence Principle

Every suitable Cube MUST be able to become a real standalone library:

- independently usable;
- independently testable;
- independently packageable;
- independently distributable;
- explicitly dependency-bound;
- free of hidden monorepo coupling;
- deterministic within its documented contract;
- secure and failure/recovery hardened;
- cross-platform where applicable;
- versioned independently;
- documented independently;
- replaceable without requiring the entire repository.

Independence does NOT mean "no dependencies ever". Explicit, versioned, resolvable dependencies are allowed.

Distributed packages must not rely on monorepo-relative runtime imports such as `../../cubes/...` escaping their package boundary.

## Multi-language and multi-platform

Sovereign is a multi-ecosystem library platform.

Target model:

`ONE AUTHORITATIVE CONTRACT -> NATIVE IMPLEMENTATION PER ECOSYSTEM -> CONFORMANCE -> INDEPENDENT DISTRIBUTION`

Targets include:

- Node.js / JavaScript;
- Python;
- Kotlin/JVM;
- Android/Kotlin;
- iOS/Apple platforms where justified.

These are native implementations of one contract, not mechanical source translations. Not every Cube needs every ecosystem; applicability and value decide.

## Distribution policy — CURRENT

**CANONICAL DISTRIBUTION: GITHUB.**

The project currently uses GitHub as the free, canonical distribution channel:

- repository source;
- Git tags;
- GitHub Releases;
- GitHub Release assets;
- checksums/integrity records;
- documentation.

External registries are intentionally NOT part of the current release operation:

- npmjs.org — deferred;
- PyPI — deferred;
- Maven Central — deferred;
- other external registries — deferred.

This is a distribution-policy decision, not a missing-credential blocker.

GitHub Packages may be used as an OPTIONAL GitHub-hosted distribution mechanism when it is technically and economically appropriate and explicitly enabled for the relevant package. Public GitHub Packages are currently free; verify current GitHub limits before relying on sustained high-volume usage. citehttps://docs.github.com/en/billing/concepts/product-billing/github-packages

GitHub Releases remain the canonical artifact distribution mechanism for release binaries/tarballs; GitHub documents release assets and no bandwidth limit for releases, with a 2 GiB per-file limit. citehttps://docs.github.com/en/repositories/releasing-projects-on-github/about-releases

Do NOT automatically publish to GitHub Packages merely because a package has a `package.json`. Evaluate whether Release assets alone are sufficient.

## Cube versus Product

A Cube is an independently usable building block.

A Product is explicit composition of Cubes.

Products may depend on multiple Cubes, but composition must not destroy Cube package independence.

## Stability and lifecycle

Use explicit states:

`IDEA -> SPEC -> IMPLEMENTING -> TESTED -> TECHNICALLY_READY -> RELEASE_CANDIDATE -> AUTHORIZED -> RELEASED -> FROZEN`

"Exists" is not "release-ready".
"Technically ready" is not "authorized".
"Authorized" is not "released".

Released/frozen components require a dedicated authorized task before modification.

## Security

Prefer fail-closed behavior at trust boundaries.

Never:

- bypass security or publication guards;
- invent credentials;
- expose secrets;
- silently swallow security-relevant failures;
- add uncontrolled retries;
- introduce unbounded resource usage;
- weaken security to satisfy tests.

## Cross-platform

Target Windows, Linux, macOS, and WSL where applicable, plus Android/iOS for applicable native implementations.

Do not encode platform behavior through accidental path, filesystem, process, or shell assumptions.

## No-redo rule

Before modifying anything:

- inspect current source;
- inspect SPEC;
- inspect tests;
- inspect package metadata;
- inspect history;
- inspect current CI evidence.

If it is already correct, verify it and move on.

## Additive evolution rule

The default behavior is:

`ADD -> EXTEND -> HARDEN -> IMPROVE -> SUPERSEDE -> DEPRECATE -> ARCHIVE -> DEFER`

before deletion or silent replacement.

Do NOT delete existing functionality, contracts, historical records, packages, tests, roadmap items, or decisions merely because a newer approach exists.

If removal is truly necessary, record why and preserve the historical context.

## Git discipline and persistence

GitHub is the durable project memory.

A meaningful milestone is not complete while important work exists only locally.

Preferred completion sequence:

`CHANGE -> TEST -> DOCUMENT -> COMMIT -> PUSH -> VERIFY REMOTE`

Before commit:

- inspect `git status`;
- inspect `git diff`;
- run `git diff --check`;
- run relevant tests;
- ensure no secrets/generated junk are committed.

After push, verify:

`local HEAD == remote branch HEAD == PR HEAD`

and verify CI against the exact claimed commit.

## Documentation persistence

Material project decisions MUST be persisted in the appropriate repository authority:

- permanent architecture → Architecture Constitution;
- project map/terminology → Knowledge Base;
- current state/task/governance → `PROJECT_CONTROL.md`;
- future sequencing → `ROADMAP.md`;
- behavioral semantics → SPEC;
- package boundary → package contract/catalog;
- release state → `docs/release/`.

Do not create competing sources of truth for dynamic state.

## Recovery

If interrupted, never restart from memory. Read:

`AGENTS.md -> PROJECT_CONTROL.md -> ROADMAP.md -> live GitHub state -> relevant SPEC`

then resume from the authoritative current task.

## Claims must be evidence-backed

Never claim "released", "published", "cross-platform verified", "package-independent", or "all tests green" without corresponding evidence for the exact commit/state being claimed.

A rerun is not proof that a historical failure never existed.

## One-current-task rule

Maintain exactly one official active milestone/task. Everything else is completed, frozen, parked, future, blocked, or a separately authorized task.

## Absolute operating principle

BUILD — DO NOT DESTROY.

EXTEND — DO NOT SILENTLY REPLACE.

RECORD — DO NOT FORGET.

VERIFY — DO NOT ASSUME.

PERSIST — DO NOT LEAVE IMPORTANT STATE LOCAL-ONLY.

PRESERVE HISTORY.
PRESERVE COMPATIBILITY.
PRESERVE INDEPENDENCE.
PRESERVE STABILITY.
PRESERVE SECURITY.
PRESERVE THE ORIGINAL VISION.
