# Sovereign Library

A collection of standalone, dependency-independent software Cubes for applications, tools, automations, agents, and Products.

## Start here

This repository is designed to be understandable and safely operable by humans and autonomous agents.

**For any agent:** read `AGENTS.md` first.

Then read:

1. `PROJECT_CONTROL.md` — authoritative current mission, governance, blockers, and recovery point.
2. `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md` — permanent architecture and independence principles.
3. `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md` — project-wide knowledge map and document hierarchy.
4. `ROADMAP.md` — sequencing and future direction.
5. The relevant Cube SPEC, API boundary, package contract, tests, and release records.

Do not use chat history as a substitute for repository evidence.

## Core principle

Every suitable Cube is intended to be a **real standalone library**, not merely an internal monorepo module.

A suitable distributable Cube should be:

- independently usable;
- independently testable;
- independently packageable;
- independently distributable;
- explicitly dependency-bound;
- free of hidden monorepo coupling;
- deterministic within its contract;
- failure/recovery hardened;
- secure;
- cross-platform where applicable;
- independently versioned;
- independently documented;
- replaceable without requiring the entire Sovereign system.

The permanent architectural model is:

`INDEPENDENT CUBES -> EXPLICIT COMPOSITION -> REAL PRODUCTS`

Products may compose many Cubes, but composition does not erase Cube independence.

## Multi-language and mobile direction

Sovereign is designed as a multi-ecosystem library platform.

The target model is:

`ONE AUTHORITATIVE CONTRACT -> NATIVE IMPLEMENTATION PER ECOSYSTEM -> CONFORMANCE -> INDEPENDENT DISTRIBUTION`

Supported/planned ecosystems include:

- **Node.js / JavaScript**
- **Python**
- **Kotlin / JVM**
- **Android**
- **iOS / Apple platforms** where justified

The implementations are native to their ecosystems and conform to the authoritative Cube contract. Not every Cube must support every ecosystem.

## Distribution policy — current

**GitHub is the canonical distribution channel for the current project phase.**

The project intentionally avoids paid or unnecessary external registry distribution at this stage.

Current distribution mechanisms:

- GitHub repository/source;
- Git tags;
- GitHub Releases;
- GitHub Release assets;
- checksums/integrity records;
- documentation and examples.

GitHub Packages is an **optional GitHub-hosted package mechanism** for packages where it provides clear value. It is not required for every Cube and must not become an implicit dependency of the repository.

External registry publication is currently deferred:

- npmjs.org;
- PyPI;
- Maven Central;
- other third-party registries.

This is a project distribution decision, not a missing-credentials blocker.

## Engineering / release discipline

Each Cube follows:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A release-ready Cube requires real implementation, meaningful tests, failure/recovery verification, security evidence, relevant platform evidence, a real consumer artifact, and documentation.

Technically ready does not mean released.
Authorized does not mean released.

## Dependency policy

Target: zero runtime third-party dependencies per Cube unless an explicit, versioned exception is justified.

Dependencies are allowed when they are explicit, versioned, resolvable in the distributed artifact, tested, and consistent with the Cube's contract.

Build/test/declaration tooling is not automatically a runtime dependency.

## Cross-platform target

Windows, Linux, macOS, and WSL where the capability supports them. Android is a first-class mobile target; iOS is a first-class future platform target.

Platform-specific behavior must be explicit and must not rely on accidental machine paths or shell assumptions.

## Current release state

The latest released Cube is:

**Application Lifecycle / Graceful Shutdown Coordinator v0.1** — PR #104, merge commit `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`.

It is **FROZEN**. Earlier released/frozen Cubes remain recorded in `ROADMAP.md` and `PROJECT_CONTROL.md`.

The first authorized package candidates are technically ready but have **not** been GitHub-released yet.

## Current architecture documents

- `AGENTS.md` — mandatory autonomous-agent operating contract.
- `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md` — permanent architecture constitution.
- `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md` — project-wide knowledge base.
- `docs/SOVEREIGN_ECOSYSTEM_CONTRACT_V1.0.json` — machine-readable project architecture/distribution contract.
- `PROJECT_CONTROL.md` — current state and governance control plane.
- `ROADMAP.md` — roadmap and sequencing.

## Repository continuity

GitHub is the durable project memory. Important decisions, implementation changes, verification evidence, blockers, deferred work, release state, and next actions must be persisted to the repository.

The default evolution model is additive:

`ADD -> EXTEND -> HARDEN -> IMPROVE -> SUPERSEDE -> DEPRECATE -> ARCHIVE -> DEFER`

Do not silently delete or replace existing functionality, historical records, tests, packages, contracts, or architecture.

## Repository shape

```text
cubes/        reusable building blocks
products/     higher-level compositions
packages/     package manifests and distribution staging targets
specs/        behavioral contracts
contracts/    shared contracts
adapters/     platform/environment adapters
examples/     usage examples
scripts/      verification/build/release tooling
docs/         architecture, governance, research, release evidence
.github/      CI/workflow automation
```

## License

Apache License, Version 2.0. See `LICENSE` and `NOTICE`.
