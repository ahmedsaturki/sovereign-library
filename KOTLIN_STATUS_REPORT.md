# Kotlin/JVM Wave — Status Report

> Living report. GitHub is the permanent source of truth. This file is reconciled
> against live `git` state and real execution, not assumptions.

## A. Exact GitHub state
- main: `04fe95b15f95f407aa4fc709254381599678a83b` (unchanged, not touched)
- branch: `feat/continuity-hardening`
- HEAD: `39a4bd97336085caa4e41c017e67ea7e9c1bc20f` (reconciled at start of wave)
- PR #125: OPEN / MERGEABLE / UNMERGED (Kotlin work committed on top in this wave)

## B. Kotlin/JVM modules
- `ecosystems/kotlin/safe-path-resolver` (SPR1)
- `ecosystems/kotlin/runtime-capability-inspector` (RCI1)
- `ecosystems/kotlin/conformance` (shared language-neutral conformance runner)

Toolchain: Kotlin 2.0.0, JVM target 17, pinned JDK toolchain, Gradle 8.9 wrapper.
Zero third-party runtime dependencies (stdlib-only JSON + serialization).

## C. SPR1 status — TECHNICALLY_READY
- Implementation: contract-faithful (`normalizePath`, `isContained`, `resolvePath`,
  `serializeReport`/`parseReport` with `{format,version,payload,integrity}` envelope).
- Unit tests: 24 pass.
- Conformance: 7/7 canonical vectors (`contracts/conformance/vectors.safe-path-resolver.json`).
- Status enum matches canonical Node: `contained | outside | limit`.
- No invented fields, no Node/Python dependency.

## D. RCI1 status — TECHNICALLY_READY
- Implementation: contract-faithful. Failure codes follow the conformant Python
  native precedent (authoritative): `OS_FAMILY_UNSUPPORTED`, `ARCHITECTURE_UNSUPPORTED`,
  `NODE_MAJOR_TOO_LOW`, `CPU_COUNT_TOO_LOW`, `MEMORY_TOO_LOW`, `EXECUTABLE_MISSING`,
  `INVALID_REQUIREMENT`, `INVALID_SNAPSHOT`, `DUPLICATE_REQUIREMENT`.
- `runtime.node` is **nullable metadata** populated only when an explicit `nodeVersion`
  is supplied — never synthesized from `java.version` (Node/JVM contract ambiguity
  resolved: JVM must NOT map into a Node version).
- `executableAvailable` uses pure `java.io.File` checks — **no Runtime.exec, no
  stream deadlock, no unconsumed process streams**.
- Exports present: `RUNTIME_CAPABILITY_FORMAT`, `RUNTIME_OS_FAMILIES`,
  `RUNTIME_ARCHITECTURES`, `serializeRuntimeReport`, `parseRuntimeReport`.
- Unit tests: 17 pass.
- Conformance: 9/9 canonical vectors (`contracts/conformance/vectors.runtime-capability-inspector.json`).
- Serialization integrity verified (checksum envelope + tamper rejection).

## E. Kotlin conformance
- Real execution: SPR1 7/7, RCI1 9/9 via `:conformance` JUnit runner that mirrors
  `python/scripts/run_conformance.py` (fresh bindings per vector, `$binding` resolution,
  method dispatch, `throws`/`expectFailuresContains`).
- NOT code-review-only — the runner is exercised in CI-equivalent `./gradlew test`.

## F. JVM artifacts
- Built: `safe-path-resolver-0.1.0.jar` (37 KB), `runtime-capability-inspector-0.1.0.jar` (50 KB).
- Contents: compiled `.class` only + manifest + `kotlin_module`. No source, no secrets,
  no `.gradle`/build junk, no repo-relative paths.

## G. Out-of-tree execution — VERIFIED
- Ran both modules from the packaged jars in an isolated directory with NO access to
  `ecosystems/kotlin/src`, `cubes/`, Node, or Python — only the jars + `kotlin-stdlib`.
- SPR1: normalize, isContained, serialize/parse round-trip (integrity envelope) all correct.
- RCI1: inspectRuntime, evaluateRuntimeRequirements (real cross-OS detection: host
  win32 vs required linux → `OS_FAMILY_UNSUPPORTED`), serialize/parse round-trip.

## H. Reproducibility — VERIFIED
- Two clean `./gradlew jar` builds produce **byte-identical** SHA-256 hashes for both jars.
- Enabled via `isPreserveFileTimestamps = false` + `isReproducibleFileOrder = true`
  in `build.gradle.kts` (`tasks.withType<Jar>`).

## I. Security — VERIFIED (out-of-tree, 10/10)
- RCI1: unsupported OS/arch → `INVALID_REQUIREMENT`; malformed serialization rejected;
  tampered checksum rejected; null/invalid snapshot → `INVALID_SNAPSHOT`;
  CPU-too-low → `CPU_COUNT_TOO_LOW`.
- SPR1: traversal blocked (`outside`/`segment-outside`); absolute escape blocked;
  deterministic normalize; malformed report rejected (`SafePathResolverError`).

## J. Cross-platform CI
- New workflow `.github/workflows/kotlin-jvm.yml`: `actions/setup-java` Temurin 17 on
  `ubuntu-latest`, `windows-latest`, `macos-15-intel`. Runs `test` (incl. conformance)
  + `jar` + reproducibility check + artifact upload. Triggers on `feat/**` push and PRs.

## K. Android applicability
- PENDING — gated until Kotlin/JVM fully proven. All gates above are now met, so Android
  evaluation may begin. No Android code written yet (per directive: do not start Android
  before Kotlin/JVM closure).

## L. Neighbors preserved (not modified)
- Node: unchanged, authoritative.
- Python: unchanged, verified (used as authoritative native precedent for RCI1 semantics).
- Browser/Products: unchanged.

## M. Historical note (preserved, not erased)
- Early wave reported `VERIFICATION_PENDING` due to missing Java runtime. JDK 17 was
  installed and the full RCI1 `serialize-roundtrip` StackOverflow (infinite recursion in
  `parseJsonObject` re-parsing from offset 0) plus stale unit-test assertions were fixed.
- RCI1 failure codes were aligned to the Python native precedent (the conformant port),
  resolving the contract ambiguity around `runtime.node` (nullable, not JVM-mapped).

## N. Release state
- NOT published externally. Frozen on branch `feat/continuity-hardening`, PR #125.
- No `main` merge, no npm publish, no Android until explicitly authorized.
