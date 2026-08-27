# Sovereign Library — Architecture Constitution v1.0

**Status:** Permanent architectural policy

This document defines the non-negotiable architectural principles for Sovereign Library and its future language, platform, package, and product ecosystem.

It is intentionally broader than any single release or technology choice. Specific behavior belongs in the relevant Cube SPEC; current execution state belongs in `PROJECT_CONTROL.md`.

## 1. Mission

Sovereign Library exists to build a durable ecosystem of small, strong, owned software building blocks that are:

- independently usable;
- independently testable;
- independently distributable;
- explicit about dependencies and capabilities;
- secure and failure-aware;
- stable and deterministic within their contracts;
- replaceable and composable;
- usable across appropriate languages and platforms.

The repository is a manufacturing and coordination system for these building blocks, not the runtime dependency of every distributed package.

## 2. Sovereign Independence Principle

**Every suitable Cube MUST be capable of standing alone.**

For a Cube intended for distribution, independence means that a consumer can use the released artifact without cloning or depending on the Sovereign monorepo layout.

A standalone Cube must not require hidden access to:

- sibling source directories;
- repository-relative filesystem paths;
- undeclared internal modules;
- development-only tooling;
- unrelated Products;
- global mutable state owned by another Cube.

Independence does not mean that a Cube can never have dependencies. Dependencies are allowed when they are:

1. explicit;
2. versioned;
3. declared by the package contract;
4. resolvable after installation;
5. included or referenced correctly by the distributed artifact;
6. covered by tests and compatibility policy;
7. consistent with the project's sovereignty and security rules.

## 3. No Hidden Coupling

The following are prohibited in a released Cube unless its own package contract explicitly makes the relationship legal:

- monorepo-relative runtime imports that escape the package boundary;
- implicit global registries;
- undocumented environment requirements;
- hidden service discovery;
- magic filesystem locations;
- machine-specific paths;
- shared mutable state across independently usable packages;
- unbounded retries or implicit background workers.

A Product may compose many Cubes. Composition MUST remain explicit and MUST NOT collapse the Cube package boundaries.

## 4. Contract Before Implementation

Behavior is defined by a SPEC.

The canonical engineering loop is:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Source code is not allowed to silently become the contract.

When implementation and SPEC disagree, the discrepancy must be resolved deliberately. Do not silently change one to match the other.

## 5. Cube Identity

Each Cube has five conceptual identities:

1. **Contract** — its SPEC and semantic guarantees.
2. **Implementation** — native source for its target ecosystem.
3. **Verification** — tests, security evidence, platform evidence, and package evidence.
4. **Distribution** — its independently consumable package/artifact.
5. **Lifecycle state** — IDEA, SPEC, IMPLEMENTING, TESTED, TECHNICALLY_READY, RELEASE_CANDIDATE, AUTHORIZED, RELEASED, FROZEN.

"Folder exists" is not a lifecycle state.

## 6. Native Multi-Language Model

Sovereign is a multi-language ecosystem, not a Node.js-only repository.

The architectural model is:

`ONE AUTHORITATIVE CONTRACT -> NATIVE IMPLEMENTATION PER ECOSYSTEM -> CONFORMANCE -> INDEPENDENT DISTRIBUTION`

Initial target ecosystems:

### Node.js / JavaScript

- JavaScript-first implementation where the repository already uses Node semantics.
- npm distribution.
- No runtime TypeScript requirement merely to consume a package.

### Python

- Native Python implementations for suitable general-purpose Cubes.
- PyPI distribution.
- Python packages MUST follow Python idioms rather than being mechanical translations of JavaScript.

### Kotlin / JVM / Android

- Native Kotlin implementations for suitable Cubes.
- Maven-compatible distribution.
- Android is a first-class target.
- Android libraries MUST behave as normal Android dependencies and MUST NOT require the Sovereign monorepo.

### iOS / Apple platforms

- First-class future platform.
- Native Swift-facing APIs are preferred where appropriate.
- Kotlin Multiplatform MAY be used where shared core logic provides real engineering value.
- Platform-specific integration remains native.

Not every Cube is required to implement every ecosystem. Applicability is decided by the Cube's contract and practical value.

## 7. Language Neutrality Without Lowest-Common-Denominator Design

The shared concept is the contract, not the source code.

Do NOT:

- mechanically transpile JavaScript into Python;
- mechanically transliterate JavaScript into Kotlin;
- force identical internal architecture on every platform;
- weaken a platform's native strengths to imitate another ecosystem.

DO:

- preserve semantic guarantees;
- preserve error meaning and stable error identifiers where appropriate;
- preserve serialization/wire contracts;
- preserve security guarantees;
- preserve determinism and recovery semantics;
- use idiomatic platform APIs.

## 8. Conformance

When a Cube has multiple implementations, conformance is tested against the authoritative contract.

Where practical, use language-neutral test vectors for:

- inputs and outputs;
- serialization formats;
- error codes;
- retryability semantics;
- boundary cases;
- security conditions;
- deterministic ordering.

Implementation-specific tests may extend the conformance suite for platform behavior without changing the shared contract silently.

## 9. Package Independence

A distributable Cube is not complete merely because `package.json`, `pyproject.toml`, or an Android module exists.

Release readiness requires a real consumer artifact.

The artifact must be tested outside the repository's source layout.

The verification model is:

`BUILD -> PACKAGE -> EXTRACT/INSTALL OUTSIDE MONOREPO -> IMPORT -> EXECUTE CONTRACT -> VERIFY EXPORTS`

For npm packages, the artifact must survive `npm pack` and out-of-tree execution.

For Python, the built distribution must install and import outside the source checkout.

For Kotlin/Android, the published Maven artifact must resolve and consume as a normal dependency.

## 10. Public API Stability

The public API is intentionally smaller than the implementation.

Rules:

- explicit exports;
- no accidental deep-import API;
- no undocumented public helpers;
- stable error taxonomy;
- stable serialization semantics where promised;
- compatibility changes are deliberate and versioned;
- frozen public APIs are not broadened casually.

## 11. Failure, Recovery, and Determinism

Sovereign components must define what happens when things go wrong.

Relevant contracts must explicitly address:

- invalid input;
- timeout;
- cancellation;
- partial failure;
- duplicate operations;
- concurrent operations;
- stale state;
- resource cleanup;
- recovery;
- bounded output and memory;
- error causality.

A successful happy-path demo is insufficient evidence of readiness.

## 12. Security

Security is part of the component contract, not a final checklist.

Preferred behavior at trust boundaries is fail-closed.

The project must avoid:

- hidden secret capture;
- unsafe command construction;
- path traversal;
- symlink escapes where not explicitly allowed;
- accessor side effects during inspection/serialization;
- unbounded recursion/allocation;
- retry amplification;
- sensitive diagnostic leakage;
- uncontrolled publication.

## 13. Capability and Data Separation

Capabilities such as filesystem, clock, process, network, browser, and environment access should be injectable or otherwise explicit where practical.

Data structures should not quietly acquire ambient capabilities.

This separation improves:

- testing;
- portability;
- determinism;
- security;
- replacement of platform adapters.

## 14. Platform Architecture

The preferred layering is:

```text
Sovereign Contract
        |
        +-- Core semantics
        |
        +-- Platform adapters
        |
        +-- Native language implementation
        |
        +-- Distribution artifact
        |
        +-- Consumer application
```

Examples:

```text
Storage Contract
    +-- Node.js filesystem adapter
    +-- Python filesystem adapter
    +-- Android storage adapter
    +-- iOS storage adapter
```

Platform adapters are not excuses for hidden divergence. Any semantic difference that matters must be documented in the contract.

## 15. Products Are Compositions

Products such as Web Test Kit and Sovereign Automation may combine many Cubes.

Products SHOULD reuse Cubes rather than reimplementing their contracts.

Products MUST NOT redefine the identity of the constituent Cubes.

The architecture is:

`INDEPENDENT CUBES -> EXPLICIT COMPOSITION -> REAL PRODUCTS`

not:

`MONOLITH -> ARTIFICIAL MODULES -> IMPLIED INDEPENDENCE`

## 16. Distribution Independence

Each ecosystem has its own normal distribution mechanism:

- Node.js → npm;
- Python → PyPI;
- Kotlin/JVM/Android → Maven-compatible repository;
- iOS → native Apple distribution strategy when activated.

A Cube may exist in the monorepo without being published.

Publication is a lifecycle event, not a source-tree property.

## 17. Release and Freeze

A release requires:

- stable contract;
- verified public API;
- tests;
- security checks;
- cross-platform evidence where supported;
- reproducible artifact evidence;
- documentation;
- explicit release authorization where governance requires it.

After release, the component may be frozen.

Frozen components are changed only through an explicit new task with its own verification and authorization path.

## 18. Independence Tiers

To scale without artificial duplication, use tiers:

### Tier A — Portable Core

General-purpose Cubes expected to have Node.js + Python + Kotlin/Android implementations when valuable.

### Tier B — Ecosystem-Native

Cubes with strong affinity to one ecosystem, such as Node process APIs or browser runtime integration.

### Tier C — Platform-Specific

Cubes that exist primarily because a platform exposes a unique capability.

Tiering is a design decision, not a quality downgrade.

## 19. Required Quality Bar

A Cube is release-ready only when the evidence supports:

`REAL IMPLEMENTATION + REAL TESTS + REAL ARTIFACT + REAL CONSUMPTION`

No placeholder implementation may be described as production-ready.

No package may be called standalone if it only works inside the monorepo.

No cross-platform claim may be made without platform evidence.

## 20. Anti-Patterns

Reject:

- giant shared runtime required by every package;
- hidden internal path imports in published artifacts;
- copied code with undocumented semantic drift;
- one package version secretly controlling unrelated Cubes;
- platform emulation when native APIs are available;
- architecture driven only by folder appearance;
- "green because the test was skipped" verification;
- release claims based only on source inspection.

## 21. Relationship to Other Governing Documents

- `AGENTS.md` — how autonomous agents must operate.
- `PROJECT_CONTROL.md` — what is happening NOW and what is allowed NOW.
- `ROADMAP.md` — intended sequence and future direction.
- relevant `specs/*.md` — exact Cube behavior.
- `docs/PACKAGE_CONTRACT_V0.1.md` — initial npm package boundary.
- `docs/PUBLIC_API_BOUNDARY_V0.1.md` — frozen public API decisions.
- `docs/PUBLIC_PACKAGE_RELEASE_READINESS_V0.1.md` — release-readiness evidence.
- `docs/PUBLIC_PACKAGE_RELEASE_AUTHORIZATION_PACKET_V0.1.md` — release authorization record.
- `docs/release/` — release execution evidence and runbooks.
- `docs/CUBE_INVENTORY_CLASSIFICATION_V0.1.md` — component inventory/classification.
- `docs/FULL_CUBE_INVENTORY_ANALYSIS.md` — deeper inventory analysis.

Where documents overlap, the source-of-truth hierarchy in `AGENTS.md` applies.

## 22. Permanent Decision

From this version forward, Sovereign Library is explicitly designed as:

**A collection of independently consumable Cubes, composed into Products, with native implementations across applicable ecosystems and a single authoritative behavioral contract.**
