# Sovereign Library — Agent Operating Contract

This file is the mandatory entry point for AI coding agents, automation agents, and other autonomous engineering tools operating in this repository, including Hermes, OpenCode, JCode, Codex, and equivalent tools.

## 1. Read first

At the beginning of every task, read in this order:

1. `AGENTS.md` — how agents must operate.
2. `PROJECT_CONTROL.md` — authoritative current mission, governance, blockers, and recovery point.
3. `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md` — permanent architecture laws.
4. `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md` — project-wide map and document hierarchy.
5. `ROADMAP.md` — sequencing and future direction.
6. The relevant SPEC, package contract, public API boundary, tests, and release records for the work being performed.

Never use conversation memory as a substitute for repository evidence.

## 2. Source-of-truth hierarchy

When information conflicts, use this precedence:

1. GitHub repository state (refs, commits, PRs, CI, releases) for actual repository state.
2. `PROJECT_CONTROL.md` for the current active task, governance state, blockers, and recovery point.
3. Relevant SPEC for behavioral semantics.
4. `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md` for architecture and independence principles.
5. `docs/PACKAGE_CONTRACT_V0.1.md` and `docs/PUBLIC_API_BOUNDARY_V0.1.md` for package/API boundaries.
6. Release documents for release execution and evidence.
7. README and other docs for user-facing explanation.
8. Conversation context only as supplemental intent, never as authoritative project state.

Historical records remain historical. Do not rewrite history to make the current state look cleaner.

## 3. Core engineering loop

For every authorized change:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Do not skip specification, failure-path testing, verification, or release gates merely because the happy path works.

## 4. Sovereign Independence Principle

Every suitable Cube MUST be designed so it can become a real standalone library:

- independently usable;
- independently testable;
- independently packageable;
- independently distributable;
- explicitly dependency-bound;
- free of hidden monorepo coupling;
- deterministic within its documented contract;
- secure and failure/recovery hardened;
- cross-platform where the capability supports it;
- versioned independently;
- documented independently;
- replaceable without requiring the entire Sovereign system.

Independence does NOT mean "no dependencies ever". A dependency is allowed when it is explicit, versioned, resolvable in the distributed artifact, tested, and consistent with the Cube's contract.

Forbidden release-time coupling includes monorepo-relative runtime imports such as `../../cubes/...` or `../../../cubes/...` that escape the package artifact boundary.

## 5. Multi-language and multi-platform contract

Sovereign is NOT a Node-only ecosystem.

The target ecosystem is:

- Node.js / JavaScript first implementation and npm distribution;
- Python native implementations and PyPI distribution for suitable general-purpose Cubes;
- Kotlin native implementations and Maven distribution for suitable Cubes;
- Android as a first-class platform using Kotlin/Android libraries;
- iOS as a first-class future platform, using native Swift-facing APIs and/or Kotlin Multiplatform where it provides real value.

The rule is:

`ONE AUTHORITATIVE CONTRACT -> NATIVE IMPLEMENTATION PER ECOSYSTEM -> CONFORMANCE VERIFICATION -> INDEPENDENT DISTRIBUTION`

Do NOT translate one language's source mechanically into another language. Preserve the contract and implement idiomatically for the target ecosystem.

Not every Cube must support every language. Language/platform support is decided by applicability and value, not by a checkbox target.

## 6. Cube versus Product

A Cube is an independently usable building block.

A Product is a composition of Cubes.

Products may depend on multiple Cubes, but product composition MUST NOT destroy the independent package boundary of the constituent Cubes.

Examples:

- `web-test-kit` composes browser + interactions + assertions.
- `sovereign-automation` composes multiple browser Cubes.

A Product does not automatically make every dependency part of one monolith.

## 7. Package model

A publishable Cube should have, as applicable:

- stable name and version;
- explicit public API;
- `exports` boundary;
- declarations where the ecosystem requires them;
- package metadata;
- license metadata;
- tests;
- security verification;
- cross-platform evidence;
- reproducible artifact verification;
- documentation;
- a tarball/install artifact that works outside the monorepo.

Distribution targets are independent:

- npm for Node.js;
- PyPI for Python;
- Maven-compatible distribution for Kotlin/Android;
- native Apple distribution strategy for iOS when that ecosystem is activated.

## 8. Conformance

Where a Cube has more than one implementation, the shared behavior is defined by its SPEC and, where useful, language-neutral conformance vectors.

Do not assume behavioral equivalence because APIs look similar.

Conformance must cover:

- successful behavior;
- error codes/semantics;
- retryability where applicable;
- serialization or wire formats;
- determinism;
- security boundaries;
- failure/recovery semantics;
- relevant platform-specific behavior.

## 9. Stability and release discipline

A component progresses through explicit states:

`IDEA -> SPEC -> IMPLEMENTING -> TESTED -> TECHNICALLY_READY -> RELEASE_CANDIDATE -> AUTHORIZED -> RELEASED -> FROZEN`

"Exists in the repository" is NOT equivalent to "release-ready".

"Technically ready" is NOT equivalent to "authorized".

"Authorized" is NOT equivalent to "published".

Released/frozen components MUST NOT be changed casually. A new task and explicit authorization are required for frozen-component modifications.

## 10. Security and failure behavior

Prefer fail-closed behavior at trust boundaries.

Never:

- bypass publication/security guards;
- invent credentials;
- expose secrets in diagnostics;
- silently swallow security-relevant failures;
- add uncontrolled retries;
- introduce unbounded resource usage;
- weaken a security boundary merely to satisfy a test.

Test negative paths, cancellation, timeout, cleanup, partial failure, malformed input, concurrency, and resource lifetime whenever relevant.

## 11. Cross-platform rule

Target:

- Windows;
- Linux;
- macOS;
- WSL where applicable;
- Android for applicable libraries;
- iOS for applicable libraries once the mobile ecosystem is activated.

Do not encode platform behavior through accidental path, process, filesystem, or shell assumptions.

## 12. One-current-task rule

There is exactly one official active milestone/task at a time.

Everything else is:

- completed;
- frozen;
- parked;
- future roadmap;
- blocked;
- or explicitly assigned as a separate authorized task.

Maintain internal backlogs if useful, but do not create competing official tasks.

## 13. No-redo rule

Before modifying anything:

- inspect current source;
- inspect SPEC;
- inspect tests;
- inspect package metadata;
- inspect git history;
- inspect CI evidence.

If it is already correct, verify it and move on.

## 14. Git discipline

Before commit:

- inspect `git status`;
- inspect `git diff`;
- run `git diff --check`;
- run relevant tests;
- ensure no secrets or generated junk are included.

Never force-push or rewrite shared history unless an explicit repository policy requires it.

After pushing, verify:

`local HEAD == remote branch HEAD == PR HEAD`

and verify CI for the exact commit being claimed.

## 15. Claims must be evidence-backed

Never claim:

- released;
- published;
- cross-platform verified;
- package-independent;
- production-ready;
- secure;
- all tests green;

without corresponding evidence.

Local success is not CI success.

A rerun is not proof that a defect never existed.

A package directory is not proof that a tarball works.

## 16. Recovery

If interrupted, do NOT restart from memory.

Read:

`AGENTS.md -> PROJECT_CONTROL.md -> ROADMAP.md -> latest Git state -> relevant SPEC`

Then resume from the authoritative immediate next task.

## 17. Project-wide permanent principle

Sovereign exists to provide small, strong, owned building blocks that can stand alone first and compose second.

The architecture MUST always prefer:

`INDEPENDENT CUBES -> EXPLICIT COMPOSITION -> REAL PRODUCTS`

never:

`HIDDEN COUPLING -> MONOLITH -> ARTIFICIAL MODULES`

## 18. Durable decision rule

A project decision is not official merely because it was discussed in chat.

Any durable decision affecting architecture, behavior, dependencies, package/distribution design, security, platforms, compatibility, product scope, release policy, or governance MUST be recorded in the repository.

Use the appropriate authoritative record:

- permanent architecture principle → `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md`
- project-wide map or terminology → `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md`
- current state/governance/task → `PROJECT_CONTROL.md`
- future sequencing → `ROADMAP.md`
- behavior → relevant SPEC
- public API → API boundary record
- packaging → package contract
- release authorization/execution → release records under `docs/release/`
- external research/decisions → research/decision ledger

Agents MUST convert important conversation decisions into the appropriate repository record before treating them as durable project knowledge.
