# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **Agent Runtime Cube v0.1** and release it before starting another cube.

## Current repository state

- Last released cube: **AI / Inference Runtime v0.1**
- Release PR: **#54**, squash-merged
- Release commit: `83e076c3b0d8e0bc5e7f25c35e865cb9655121e9`
- Pre-merge verification: **Run 403**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 404**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- AI / Inference Runtime v0.1 is therefore **FROZEN**.
- The release provides provider-neutral request normalization, immutable request/result snapshots, synchronous and streaming inference contracts, cancellation/timeout handling, native child-process/NDJSON execution without shell invocation, bounded diagnostics, typed fail-closed errors, and zero runtime third-party dependencies.
- `ROADMAP.md` and `README.md` must now record AI as released and activate Agent Runtime.
- Duplicate Redaction PR #47 remains closed as superseded by PR #45.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**AGENT-RUNTIME-V0.1-SPEC**

### Immediate next task

Freeze and implement the public contract for a standalone native agent runtime:

1. immutable agent definitions and validated identity/configuration
2. deterministic turn/session state machine
3. bounded conversation memory and context accounting
4. explicit tool-call request/result envelope contracts
5. deterministic tool registry and capability allowlisting
6. cancellation, timeout, retry, and terminal-state semantics
7. bounded step count, tool calls, output, and diagnostic work
8. explicit handoff/delegation contract without multi-agent orchestration
9. failure isolation and recoverable session snapshots
10. typed fail-closed `AgentError` without arbitrary prompt/tool payload copying
11. zero runtime third-party dependencies
12. unit, contract, integration, failure, recovery, and cross-platform gates
13. public standalone SPEC plus README/example before release

## Scope lock

For Agent Runtime Cube v0.1, the allowed scope is only:

- local in-process agent coordination
- immutable agent definition/configuration
- deterministic session/turn state machine
- bounded conversation context
- explicit tool registry and capability allowlisting
- typed tool-call request/result envelopes
- cancellation, timeout, retry, and terminal-state behavior
- bounded step/tool/output/diagnostic work
- recoverable immutable session snapshots
- typed fail-closed diagnostics
- local unit, contract, integration, failure, and recovery tests
- cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- multi-agent orchestration
- network tool marketplaces
- vector databases/RAG
- embeddings/ranking
- GUI/chat application
- model training/fine-tuning
- provider SDKs
- browser automation features
- remote deployment/control plane

## Definition of done

A milestone is DONE only when:

- implementation exists
- public API is documented
- normal-path tests pass
- failure-path tests pass
- cleanup/restart behavior is verified where applicable
- supported-platform checks pass or documented capability limits exist
- example usage works
- release artifact is reproducible
- no known blocking defect remains
- `ROADMAP.md` is updated
- `PROJECT_CONTROL.md` points to the next active milestone

## Anti-loop rules

- Do not redesign the whole architecture during a cube release.
- Do not add a new dependency to solve a local problem without recording the decision.
- Do not start a second cube because the current cube is difficult.
- Do not expand scope because a competitor has more features.
- Do not call a cube production-ready from source inspection alone.
- If a problem is outside the active scope, park it and continue.

## Lessons-learned rule

Every blocking bug or CI failure must produce:

- root-cause identification
- minimal fix
- regression test
- CI protection when applicable
- documentation/control update when the lesson affects future work

## Clean-repository rule

`main` is the product branch. Temporary verification branches and PRs must not become runtime artifacts. Release merges should prefer a clean, single-purpose history. No marker files, generated dependency trees, vendor directories, or unused compatibility layers belong in the product.

## Decision rule

When uncertain, choose the smallest implementation that satisfies the current contract and can later be replaced without breaking consumers.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart the project from memory.

## Release sequence

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

No step may be skipped by calling the project complete early.
