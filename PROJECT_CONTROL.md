# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It keeps development finite, visible, and recoverable.

**Agent entry:** every autonomous agent must read `AGENTS.md` first, then this file. The permanent architecture contract is `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md`, and the project-wide knowledge map is `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md`.

## Current mission

**LIBRARY DISTRIBUTION EXPANSION — ACTIVE (GitHub-first / free multi-channel optional)**

The immediate objective is to qualify existing Sovereign Cubes as real standalone libraries without deleting, replacing, or destabilizing completed work, while preparing free, reproducible distribution channels for later release waves.

## Current repository state

- Latest released cube: **Application Lifecycle / Graceful Shutdown Coordinator v0.1**
- Release PR: **#104**, merged
- Release merge commit: `792f1f3f1d5d85fc3e75716f5dd3b365799f32c4`
- Application Lifecycle / Graceful Shutdown Coordinator v0.1 is **FROZEN**.
- **RELEASED (Phase-0 First Batch):**
  - `@sovereign/safe-path-resolver` v0.1.0 → GitHub Release v0.1.0-safe-path-resolver; CI Run #862; tarball verified independent (6 files, no monorepo paths)
  - `@sovereign/runtime-capability-inspector` v0.1.0 → GitHub Release v0.1.0-runtime-capability-inspector; CI Run #862; tarball verified independent (2 files, no monorepo paths)
- Process Supervisor / Managed Child Lifecycle v0.1 remains **FROZEN** at `881435f121d09099b9b263fa906f0968c42e4539`.
- Filesystem Recovery Journal / Operation Ledger v0.1 remains **FROZEN** at `7c197ce5e2d78b0df16265b6c6897812c56ca2`.
- Safe File Quarantine / Delete v0.1 remains **FROZEN** at `699d4181f0775af93b62d78f47fb00de42ec346e`.
- Bounded File Content Reader / Safe Content Access v0.1 remains **FROZEN** at `f8db5a309aef655aec86051587bdf12d34f3dd20`.
- Filesystem Permission / Ownership Descriptor v0.1 remains **FROZEN** at `69028a66b3827ecfee4a70f2460998dd333f02e0`.
- Atomic Batch File Transaction / Safe Multi-File Commit v0.1 remains **FROZEN** at `1fae6399eb2710b53cc8f53878138ae9a24a241d`.
- File Lease / Advisory Lock v0.1 remains **FROZEN** with corrective hardening at `a2eb715a558d9c88f19e9ff83ff512971e548891`.
- License decision: **Apache License 2.0**, merged by PR #106 at `37bdac72bd86c3a190035f3a36a2cfe497fe2812`.
- API boundary verification: **Run #782**, passed on Ubuntu, Windows, and macOS-15-Intel.
- Declaration pilot verification: **Run #809**, passed on Ubuntu, Windows, and macOS-15-Intel, including exact public-surface matching for the first two pilot candidates.
- Package contract: **DONE / VERIFIED**, merged by PR #108 at `b7b8f985058fb4a13e73cf255dd6fdf7508da5bd`; verification **Run #812** passed on Ubuntu, Windows, and macOS-15-Intel.
- Package tooling, reproducibility, and security verification: **DONE / VERIFIED** by **Run #835**, passed on Ubuntu, Windows, and macOS-15-Intel.
- Publication guard implementation: merged in commit `91ff69c40c72b62e97d6e1e07a83f87397acacdc` and wired into CI at `9e2ca35668e5ad2923a8c6c6c4992483a07b181d`.
- Final pre-authorization verification: **Run #845**, commit `f14bbd9229fcda23f00602cfc9288881c61e213e`, passed completely on Ubuntu, Windows, and macOS-15-Intel.
- Release-readiness and authorization documents remain historical evidence; current distribution policy is recorded below.

## Project-wide architecture law

The repository-wide independence and ecosystem model is governed by:

- `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md`
- `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md`
- `docs/SOVEREIGN_ECOSYSTEM_CONTRACT_V1.0.json`
- `GOVERNANCE.md`

The permanent principle is:

**INDEPENDENT CUBES -> EXPLICIT COMPOSITION -> REAL PRODUCTS**

A suitable Cube is intended to be independently usable, testable, packageable, distributable, versioned, secure, deterministic within contract, failure/recovery hardened, cross-platform where applicable, and replaceable without requiring the whole repository.

Sovereign is not Node-only. The ecosystem target is:

`ONE AUTHORITATIVE CONTRACT -> NATIVE IMPLEMENTATION PER ECOSYSTEM -> CONFORMANCE -> INDEPENDENT DISTRIBUTION`

Target ecosystems include Node.js, Python, Kotlin/JVM, Android, and future iOS/Apple platforms where a Cube is applicable and valuable. These are implementation/distribution targets, not a claim that every Cube already has every port.

An internal dependency is allowed only when it is explicit, versioned, resolvable in the distributed artifact, tested, and consistent with the Cube contract. Monorepo-relative runtime coupling must not leak into released packages.

## Current distribution policy

**GITHUB-FIRST / FREE-MULTI-CHANNEL-OPTIONAL.**

GitHub remains the canonical source, persistent project memory, release-evidence home, and default distribution channel.

Distribution is intentionally free-by-default. Additional ecosystem registries are **optional and deferred by release wave**, not permanently prohibited. A registry may be enabled for a release only when it is genuinely free for the intended workload, technically appropriate, secure, reproducible, and explicitly selected for that release wave.

Canonical GitHub mechanisms:

- Git repository/source;
- Git tags;
- GitHub Releases;
- GitHub Release assets;
- checksums/integrity records;
- documentation and examples.

Optional free ecosystem mechanisms may include npm, PyPI, Maven-compatible registries/Maven Central, GitHub Packages, JSR, or other appropriate services, subject to current terms/limits and a deliberate release decision. No paid registry or mandatory third-party service is required.

No external publication should be attempted merely because a package is technically ready. Release timing and channel selection remain explicit controls.

Historical wording that prohibited external registries absolutely is superseded by this policy and remains preserved as history in governance/release records.

## Current packaging wave

Existing suitable Cubes are being qualified as genuine standalone libraries.

Current package catalog: `scripts/package-catalog.json`.

Current qualification matrix: `docs/release/PACKAGE_QUALIFICATION_MATRIX-V0.1.md`.

The current reported Node packaging wave contains **74 package entries representing 73 unique Cube sources**, with the known distinction that `safe-path-resolver` is the package identity for the `safe-path-resolver-containment-boundary` source Cube.

The qualification rules remain stricter than merely creating `package.json`: exact public API, declaration surface, package boundary, out-of-tree use, reproducibility, security, documentation, and applicable CI evidence are required.

Remaining categories include:

- browser/integration Cubes kept PRE-RELEASE until their own release wave;
- Cubes with unresolved runtime coupling kept CONDITIONAL until the dependency boundary can be made real without breaking monorepo behavior;
- future native Python/Kotlin/Android implementations only where justified by the authoritative contract and practical value.

## Continuity and non-destructive evolution

GitHub is the durable project memory.

Meaningful work is complete only after:

`CHANGE -> TEST -> DOCUMENT -> COMMIT -> PUSH -> VERIFY REMOTE`

The default evolution policy is additive:

`ADD -> EXTEND -> HARDEN -> IMPROVE -> SUPERSEDE -> DEPRECATE -> ARCHIVE -> DEFER`

Do not silently delete or replace working functionality, contracts, tests, packages, history, or architecture merely because a newer approach exists.

Historical failures remain historical evidence. Current state must be updated separately rather than rewriting history.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Current milestone:

**LIBRARY DISTRIBUTION EXPANSION — ACTIVE**

Immediate next task:

**Continue qualification and hardening of existing standalone library candidates, reconcile evidence, and prepare GitHub release artifacts for the authorized packages; optional free ecosystem publication may be enabled later as a separate release decision.**

Everything else is parked in `ROADMAP.md`, issue/task records, or explicit future status.

## Release state

The first two Phase-0 candidates remain authorized in principle:

-  v0.1.0 → RELEASED (GitHub Release v0.1.0-safe-path-resolver; npm publish DEFERRED per policy; tarball verified independent)
- 
- `@sovereign/runtime-capability-inspector` v0.1.0

They are **TECHNICALLY_READY / AUTHORIZED / NOT YET GITHUB-RELEASED**.

External publication is intentionally deferred by current project timing/policy, not because the technical artifacts are invalid.

A package is not `RELEASED` until an actual GitHub release/artifact distribution event is evidenced.

## Known frozen-cube timing issues

The released/frozen `application-lifecycle`, `atomic-batch-file-transaction`, and `process-supervisor` cubes contain documented timing-sensitive tests. They are not modified by unrelated library-distribution work. Any remediation requires a dedicated authorized task.

## Recovery point

A new agent must recover by reading:

`AGENTS.md -> GOVERNANCE.md -> PROJECT_CONTROL.md -> ROADMAP.md -> Architecture Constitution -> Project Knowledge Base -> live GitHub state -> relevant SPEC -> package/release records`

Never rely on chat history as authoritative state.
