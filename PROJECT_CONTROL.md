# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **AI / Inference Runtime Cube v0.1** and release it before starting another cube.

## Current repository state

- Last released cube: **Reporting / Export v0.1**
- Release PR: **#53**, squash-merged
- Release commit: `5f55612ca772d53a87de4e852e6695b71dba7a69`
- Pre-merge verification: **Run 397**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Post-merge verification: **Run 398**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Reporting / Export v0.1 is therefore **FROZEN**.
- The release provides deterministic report snapshots, stable JSON/CSV exports, bounded async CSV streaming, deterministic filtering/order/grouping/aggregation, immutable results, typed fail-closed diagnostics, and zero runtime third-party dependencies.
- The current CI/release history includes prior cross-platform stability hardening for Worker Pool timing and repeated snapshot/report boundary checks.
- `ROADMAP.md` and `README.md` must now record Reporting as released and activate AI / Inference Runtime.
- Duplicate Redaction PR #47 remains closed as superseded by PR #45.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**AI-INFERENCE-RUNTIME-V0.1-SPEC**

### Immediate next task

Freeze the public contract for a standalone provider-neutral local inference runtime:

1. define bounded request/message and response contracts
2. define deterministic system/user/assistant message normalization
3. define provider-neutral generation options without model-specific SDK coupling
4. define immutable request/response snapshots
5. define synchronous result and streaming delta event semantics
6. define cancellation and timeout behavior
7. define bounded context, output, event, and diagnostic work
8. define a native process/stdio adapter contract without shell execution
9. define malformed adapter output and provider failure recovery semantics
10. define typed fail-closed errors without arbitrary payload copying
11. verify zero runtime third-party dependencies
12. define unit, contract, integration, failure, recovery, and cross-platform gates
13. write the standalone cube specification before implementation

## Scope lock

For AI / Inference Runtime Cube v0.1, the allowed scope is only:

- local in-process inference runtime coordination
- normalized system/user/assistant messages
- provider-neutral generation options
- bounded request/response/event payloads
- immutable request/result snapshots
- synchronous inference result contract
- streaming delta event contract
- cancellation and timeout handling
- native child-process stdio/NDJSON adapter without shell execution
- bounded stdout/stderr parsing
- typed fail-closed diagnostics
- local unit, contract, integration, failure, and recovery tests
- cross-platform verification
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- model weights
- model training/fine-tuning
- network provider clients
- OpenAI/Anthropic/Gemini SDK wrappers
- agent planning and tool orchestration
- RAG/vector databases
- embeddings/search ranking
- prompt marketplace/templates
- multi-agent workflows
- GUI/chat application

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
