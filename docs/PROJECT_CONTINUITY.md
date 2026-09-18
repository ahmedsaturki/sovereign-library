# Sovereign Library — Continuity Contract

**Status: permanent project policy.**

Sovereign Library must be recoverable from GitHub without relying on chat history, model memory, a local workspace, or a specific agent.

## Rules

- GitHub is the persistent memory and system of record.
- Important decisions and completed work must be persisted to the repository.
- Default evolution is additive: add, extend, harden, improve, supersede, deprecate, archive, or defer before removing anything.
- Never silently delete, erase, replace, or rewrite capabilities, APIs, tests, decisions, evidence, or history.
- Historical failures remain historical evidence.
- A meaningful milestone is not complete until relevant evidence is documented, committed, pushed, and remotely reconciled.
- When live GitHub state conflicts with an old document or report, live GitHub wins; reconcile the current-state record without rewriting history.
- Maintain one official current milestone in `PROJECT_CONTROL.md`.

## Work Loop

**UNDERSTAND → INSPECT → SPECIFY → IMPLEMENT → TEST → FIX → VERIFY → DOCUMENT → PERSIST → COMMIT → PUSH → CI → RECONCILE → NEXT**

## Recovery Loop

**AGENTS.md → PROJECT_CONTROL.md → ROADMAP.md → Architecture Constitution → Project Knowledge Base → live GitHub → relevant SPEC → current task**

## Architecture Preservation

**INDEPENDENT CUBES → EXPLICIT COMPOSITION → REAL PRODUCTS**

A suitable Cube is expected to be independently usable, testable, packageable, distributable, versioned, documented, secure, and free of hidden monorepo runtime coupling.

For multi-ecosystem implementations:

**ONE AUTHORITATIVE CONTRACT → NATIVE IMPLEMENTATION PER ECOSYSTEM → CONFORMANCE → INDEPENDENT DISTRIBUTION**

Current long-term ecosystem targets include Node.js, Python, Kotlin/JVM, Android, and iOS/Apple-native or KMP where justified.

## Distribution

Current distribution policy is **GitHub-only**. External registries are deferred by policy. This does not weaken the requirement that a suitable Cube be a real standalone library.

## Agent Requirement

Any agent working on Sovereign must leave durable project memory behind. If knowledge is important enough to affect future work, it belongs in the repository.
