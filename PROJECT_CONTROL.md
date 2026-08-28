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
- Safe-path dependency-boundary qualification: **Run #33172159240**, final qualification job passed; commit `358cfef8ca168baa9e8402ecd972b2b0bc4d7e48` contains the resulting migration and cleanup. The qualification evidence covered all four previously Conditional consumers plus the existing safe-path/runtime-capability package candidates: targeted tests, package staging, declarations, npm pack contents, reproducibility, and security boundary checks all passed.
- Release-readiness and authorization documents remain historical evidence; current distribution policy is recorded below.

## Project-wide architecture law

The repository-wide independence and ecosystem model is governed by:

- `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md`
- `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md`
- `docs/SOVEREIGN_ECOSYSTEM_CONTRACT_V0.1.json`
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

The current reported Node packaging wave contains **78 package entries representing 77 unique Cube sources**, with the known distinction that `safe-path-resolver` is the package identity for the `safe-path-resolver-containment-boundary` source Cube.

The qualification rules remain stricter than merely creating `package.json`: exact public API, declaration surface, package boundary, out-of-tree use, reproducibility, security, documentation, and applicable CI evidence are required.

Remaining categories include:

- browser/integration Cubes kept PRE-RELEASE until their own release wave;
- The four previously Conditional safe-path-resolver consumers now use explicit @sovereign/safe-path-resolver dependency boundaries and qualify as TECHNICALLY_READY;
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

**Continue the Browser/Product package-readiness wave. The language-neutral conformance layer for SPR1 + RCI1 and the first native Python ports for `@sovereign/safe-path-resolver` and `@sovereign/runtime-capability-inspector` are COMPLETE and CI-verified on the earlier `aa8d0eb` source state. The Browser/Product wave remains PRE-RELEASE until its package contracts are independently satisfied. Do not claim Browser/Product completion unless manifests, declarations, dependency boundaries, out-of-tree execution, reproducibility, security, cross-platform behavior, and applicable real-browser/product evidence are all verified and persisted. Optional free ecosystem publication remains a separate release decision.**

Everything else is parked in `ROADMAP.md`, issue/task records, or explicit future status.

## Post-Python / Browser-Product reconciliation

The first native Python wave is complete: native SPR1 and RCI1 ports pass their canonical vectors and native tests, and the dedicated Python CI is green on Python 3.9 and 3.12 across Ubuntu, Windows, and macOS. The next technical layer is therefore Browser/Product package readiness.

The seven Browser integration Cubes remain **PRE_RELEASE** in the authoritative qualification matrix. This means the Browser/Product wave is **active and not complete**. No roadmap or release record should mark those seven Cubes as released or technically ready until the full independent package contract is evidenced.

This reconciliation is intentionally additive: it does not rewrite or delete historical Python, Browser, or release records.

## Current control-plane reconciliation — authoritative after the post-Python documentation commits

The current feature branch contains subsequent documentation-only reconciliation commits after the Python verification baseline. The latest branch HEAD must be read from GitHub; the earlier `aa8d0eb` value above is a **source/CI evidence baseline**, not a claim that it remains the branch tip.

At the time of this reconciliation, the latest branch HEAD is `7dbf4def65fff67d77bbc0d8db8eda5b32594478`. The latest full verification evidence remains Run #990 / id `33185721902` on source state `aa8d0eb`, while the subsequent commits only reconcile project-control/roadmap documentation. Therefore do not describe Browser/Product as complete from this record.

The authoritative current execution task is:

**Browser/Product package-readiness qualification — active.**

The seven Browser integration Cubes remain `PRE_RELEASE` until independent package contracts and their applicable verification evidence are complete.
