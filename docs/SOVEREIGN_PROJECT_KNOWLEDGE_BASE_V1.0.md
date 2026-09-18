# Sovereign Library — Project Knowledge Base v1.0

This document is the durable map of the project. It tells a human or autonomous agent where to find authoritative information without relying on chat history.

## 1. What Sovereign Library is

Sovereign Library is a system for building small, strong, owned software building blocks called **Cubes** and composing them into **Products**.

The project is intentionally:

- standalone-first;
- dependency-explicit;
- security-conscious;
- deterministic within contract;
- failure/recovery hardened;
- cross-platform where applicable;
- independently distributable;
- multi-language capable;
- mobile-capable;
- product-composable without becoming a monolith.

## 2. Permanent architectural direction

The permanent project model is:

`INDEPENDENT CUBES -> EXPLICIT COMPOSITION -> REAL PRODUCTS`

A suitable Cube can become a normal library that a consumer installs and uses independently.

The ecosystem target is:

`ONE AUTHORITATIVE CONTRACT -> NATIVE IMPLEMENTATION PER ECOSYSTEM -> CONFORMANCE -> INDEPENDENT DISTRIBUTION`

Target ecosystems:

- Node.js / JavaScript → npm
- Python → PyPI
- Kotlin / JVM / Android → Maven-compatible distribution
- iOS / Apple platforms → native Swift-facing distribution and/or Kotlin Multiplatform where justified

Not every Cube must support every ecosystem. Applicability is determined by the Cube's contract and actual value.

## 3. Canonical source-of-truth map

| Concern | Authoritative record |
|---|---|
| Current task / current state / governance | `PROJECT_CONTROL.md` |
| Agent operating rules | `AGENTS.md` |
| Architecture laws | `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md` |
| Project knowledge map | `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md` |
| Roadmap and sequence | `ROADMAP.md` |
| Cube behavior | relevant `specs/*.md` |
| Public API | `docs/PUBLIC_API_BOUNDARY_V0.1.md` and candidate-specific records |
| npm package contract | `docs/PACKAGE_CONTRACT_V0.1.md` |
| Type/declaration strategy | `docs/DECLARATION_STRATEGY_V0.1.md` |
| Cube inventory/classification | `docs/CUBE_INVENTORY_CLASSIFICATION_V0.1.md` |
| Full inventory analysis | `docs/FULL_CUBE_INVENTORY_ANALYSIS.md` |
| Legal/distribution policy | `docs/LEGAL_AND_DISTRIBUTION_POLICY_V0.1.md` |
| Release readiness | `docs/PUBLIC_PACKAGE_RELEASE_READINESS_V0.1.md` |
| Release authorization | `docs/PUBLIC_PACKAGE_RELEASE_AUTHORIZATION_PACKET_V0.1.md` and `docs/release/AUTHORIZATION_PACKAGE_STATUS-V0.1.json` |
| Release execution | `docs/release/RELEASE-RUNBOOK-V0.1.md` and `docs/release/PROCESS-V0.1.md` |
| CI verification | `.github/workflows/` and repository verification scripts |
| Historical changes | `CHANGELOG.md`, Git commits, merged PRs, release records |
| Competitive research | `docs/COMPETITIVE_ANALYSIS_BROWSER_CUBE.md`, `docs/COMPLETE_COMPETITIVE_ANALYSIS_V0.1.md`, research ledger files |
| External research/decisions | `docs/OPEN-SOURCE-RESEARCH-LEDGER.md` and decision documents |

## 4. Lifecycle model

Every component is tracked through an explicit lifecycle:

`IDEA -> SPEC -> IMPLEMENTING -> TESTED -> TECHNICALLY_READY -> RELEASE_CANDIDATE -> AUTHORIZED -> RELEASED -> FROZEN`

Interpretation:

- **IDEA** — proposed only.
- **SPEC** — contract exists.
- **IMPLEMENTING** — active implementation work.
- **TESTED** — implementation has meaningful tests.
- **TECHNICALLY_READY** — contract, implementation, tests, security, and required platform/package evidence are sufficient.
- **RELEASE_CANDIDATE** — assembled artifact is prepared for release.
- **AUTHORIZED** — governance explicitly permits release.
- **RELEASED** — actual distribution/publication happened and is evidenced.
- **FROZEN** — released/stable and protected from casual modification.

Never collapse these states.

## 5. Cube definition of done

A suitable standalone Cube is considered complete only when its evidence supports:

- documented behavior;
- real implementation;
- focused tests;
- failure/recovery behavior;
- security checks;
- relevant cross-platform verification;
- explicit dependencies;
- package boundary;
- actual distribution artifact;
- out-of-tree or out-of-repository consumption;
- public API verification;
- documentation;
- CI evidence;
- release state explicitly recorded.

## 6. Product definition

A Product is a higher-level composition of Cubes.

Products should reuse lower-level Cubes and should not duplicate their semantics without a deliberate reason.

Products may have broader dependencies than individual Cubes, but constituent Cubes remain independently consumable when their contracts promise independence.

## 7. Distribution model

### Node.js

- Package manager/distribution: npm.
- JavaScript-first implementation where appropriate.
- Public `exports` are explicit.
- No hidden monorepo runtime dependencies.

### Python

- Distribution: PyPI.
- Native Python implementation for suitable Cubes.
- Python API follows Python idioms.
- Behavioral equivalence comes from the shared SPEC/conformance tests, not copied source code.

### Kotlin / Android

- Distribution: Maven-compatible artifact.
- Native Kotlin implementation for suitable Cubes.
- Android libraries behave as ordinary Android dependencies.
- Platform APIs are isolated behind explicit adapters when needed.

### iOS

- Distribution and integration follow Apple-native expectations.
- Swift-facing APIs are preferred for Apple consumers when appropriate.
- Kotlin Multiplatform may provide shared core semantics where it clearly reduces risk or duplication.

## 8. Independence rules

A released library must not require:

- cloning the Sovereign repository;
- access to sibling source paths;
- hidden global state from unrelated Cubes;
- undeclared internal dependencies;
- development-only tooling;
- local machine paths;
- unrelated Products.

An internal dependency is valid only when the distributed package can resolve it through a supported, explicit dependency boundary.

## 9. Conformance strategy

When a Cube exists in multiple ecosystems:

1. the SPEC defines the semantic contract;
2. language-specific implementations follow local idioms;
3. shared test vectors are used where practical;
4. error identifiers/semantics are aligned where the contract requires it;
5. security and determinism requirements remain invariant unless platform differences are explicitly documented.

## 10. Current project structure

The repository generally separates:

```text
cubes/       reusable building blocks
products/    higher-level compositions
packages/    distribution/package manifests and staging targets
specs/       behavioral contracts
contracts/   shared contract material
adapters/    platform/environment adapters
examples/    usage examples
scripts/     verification/build/release tooling
docs/        governance, architecture, research, release evidence
.github/     CI/workflow automation
```

The exact structure may evolve; current repository state is authoritative.

## 11. Current known project domains

Sovereign work spans, as applicable:

- filesystem and safe paths;
- storage and transactional file operations;
- process and lifecycle management;
- runtime/environment capability inspection;
- serialization and canonicalization;
- networking and HTTP primitives;
- scheduling/retry/timeout/concurrency infrastructure;
- browser runtime and browser automation;
- assertions, snapshots, recording, network interception, tabs, visual testing;
- web testing and automation Products;
- future agent/AI/runtime compositions.

This list is a domain map, not a claim that every domain is currently released.

## 12. Mobile strategy

Mobile is a first-class ecosystem, with Android as the first concrete target.

The strategy is:

- portable contracts;
- native Kotlin implementations where valuable;
- Android-specific adapters for Android capabilities;
- no requirement that Android depend on Node.js;
- no requirement that an Android consumer install the Sovereign monorepo;
- future iOS support through native Apple APIs and/or KMP where justified.

## 13. Governance and change control

Current execution is controlled by `PROJECT_CONTROL.md`.

The one-current-task rule applies to official work.

A new idea becomes active only when the control plane promotes it into the current task.

Frozen components require a dedicated authorized change path.

## 14. How an agent should work

An autonomous agent should:

1. read `AGENTS.md`;
2. read `PROJECT_CONTROL.md`;
3. read this knowledge base and the architecture constitution;
4. read the roadmap;
5. inspect the relevant SPEC and implementation;
6. verify GitHub state and CI;
7. preserve completed work;
8. fix only genuine defects within scope;
9. produce reproducible evidence;
10. update the appropriate record before stopping.

An agent should never assume the repository state from an earlier conversation.

## 15. How to resolve conflicts

If documents disagree:

- GitHub state wins for actual refs/commits/CI/releases.
- `PROJECT_CONTROL.md` wins for current mission and governance.
- The relevant SPEC wins for behavior.
- The architecture constitution wins for permanent architectural principles.
- Package/API contracts win for packaging/public API boundaries.
- Release records win for historical release evidence.
- Human-readable READMEs explain; they do not silently override authoritative records.

## 16. Permanent project statement

Sovereign Library is intended to become an ecosystem of **real, independently usable libraries**, not merely a monorepo of internal modules.

Every suitable Cube should be able to graduate from:

`SOURCE -> TESTED COMPONENT -> STANDALONE LIBRARY -> DISTRIBUTED ARTIFACT -> FROZEN CONTRACT`

while Products remain explicit compositions above those independent building blocks.
