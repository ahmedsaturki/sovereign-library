# Sovereign Library — Kotlin/JVM Ecosystem

Standalone, dependency-free "cubes" for the JVM, written in Kotlin against the
language-neutral Sovereign Library contracts. Each cube is independently usable.

## Modules
- `safe-path-resolver` (SPR1) — containment-boundary path resolution.
- `runtime-capability-inspector` (RCI1) — runtime capability requirements evaluation.
- `conformance` — shared JUnit runner that executes the canonical language-neutral
  conformance vectors (`contracts/conformance/vectors.*.json`).

## Requirements
- JDK 17 (toolchain pinned in `build.gradle.kts`).
- Gradle 8.9 wrapper (no install required).

## Build, test, conformance
```bash
./gradlew test --no-daemon     # runs unit tests + 9/9 RCI1 + 7/7 SPR1 conformance
./gradlew jar  --no-daemon     # builds reproducible JVM artifacts
```

## Contract fidelity
- SPR1 status enum: `contained | outside | limit` (matches canonical Node).
- RCI1 failure codes follow the authoritative conformant Python port
  (`OS_FAMILY_UNSUPPORTED`, `ARCHITECTURE_UNSUPPORTED`, `NODE_MAJOR_TOO_LOW`,
  `CPU_COUNT_TOO_LOW`, `MEMORY_TOO_LOW`, `EXECUTABLE_MISSING`, `INVALID_REQUIREMENT`,
  `INVALID_SNAPSHOT`, `DUPLICATE_REQUIREMENT`).
- `runtime.node` is nullable metadata, populated only with an explicit `nodeVersion`;
  it is never derived from `java.version` (JVM must not map into a Node version).
- `executableAvailable` uses plain `java.io.File` checks — no process spawning,
  no stream deadlocks.

## Artifacts
- `safe-path-resolver/build/libs/safe-path-resolver-0.1.0.jar`
- `runtime-capability-inspector/build/libs/runtime-capability-inspector-0.1.0.jar`

Reproducible: two clean builds yield byte-identical jars (timestamps normalized,
entry order sorted).

## Status
SPR1: TECHNICALLY_READY · RCI1: TECHNICALLY_READY. See `../../KOTLIN_STATUS_REPORT.md`.
