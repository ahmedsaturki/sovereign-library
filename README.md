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

- **Node.js / JavaScript** → npm
- **Python** → PyPI for suitable general-purpose Cubes
- **Kotlin / JVM** → Maven-compatible distribution
- **Android** → first-class Kotlin/Android library target
- **iOS / Apple platforms** → native Swift-facing distribution and/or Kotlin Multiplatform where justified

Not every Cube must support every ecosystem. Support is decided by applicability and actual value.

Node.js, Python, Kotlin, and mobile implementations are **native implementations of one contract**, not mechanical source translations.

## Engineering / release discipline

Each Cube follows:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A release-ready Cube requires real implementation, meaningful tests, failure/recovery verification, security evidence, relevant platform evidence, a real consumer artifact, and documentation.

## Dependency policy

Target: zero runtime third-party dependencies per Cube unless an explicit versioned exception is approved.

Dependencies are allowed when they are explicit, versioned, resolvable in the distributed artifact, tested, and consistent with the Cube's contract.

Build/test/declaration tooling is not automatically a runtime dependency.

## Cross-platform target

Windows, Linux, macOS, and WSL where the capability is supported. Android is a first-class future distribution target; iOS is a first-class future platform target.

Platform-specific behavior must be explicit and must not rely on accidental machine paths or shell assumptions.

## Current release state

The latest released Cube is:

**Application Lifecycle / Graceful Shutdown Coordinator v0.1** — PR #104, merge commit `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`.

It is **FROZEN**. Earlier released/frozen Cubes remain recorded in `ROADMAP.md` and `PROJECT_CONTROL.md`.

The current First Public Package Batch has explicit human release authorization, but publication is currently blocked by the environment prerequisite recorded in `PROJECT_CONTROL.md` and `docs/release/AUTHORIZATION_PACKAGE_STATUS-V0.1.json`.

## Current architecture documents

- `AGENTS.md` — mandatory autonomous-agent operating contract.
- `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md` — permanent architecture constitution.
- `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md` — project-wide knowledge base.
- `docs/SOVEREIGN_ECOSYSTEM_CONTRACT_V1.0.json` — machine-readable project architecture/distribution contract.
- `PROJECT_CONTROL.md` — current state and governance control plane.
- `ROADMAP.md` — roadmap and sequencing.

## Phase 0 — First Public Package Batch

Completed gates include inventory/classification, Apache-2.0 licensing, public API boundary, declaration strategy, package contract/tooling, reproducible packaging/security verification, and publication-guard preparation.

The two current release candidates are:

1. `@sovereign/safe-path-resolver` v0.1.0
2. `@sovereign/runtime-capability-inspector` v0.1.0

They are technically verified and explicitly authorized. Publication remains blocked only by the human-owned npm environment prerequisite; the repository must never bypass that prerequisite by inventing credentials or altering the guard.

The controlled path is:

`AUTHORIZED -> FINAL CLEAN VERIFY -> TAG/RELEASE -> PUBLISH -> POST-PUBLISH VERIFY -> FREEZE`

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
