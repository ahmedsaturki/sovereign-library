# Sovereign Library — Project Control

## Purpose

This file is the anti-drift control for the repository. It exists to keep development finite, visible, and recoverable.

## Current mission

Finish **CLI / Command Runtime Cube v0.1** and release it before starting another cube.

## Current repository state

- Last released cube: **Canonical JSON / Normalization v0.1**
- Release PR: **#49**, squash-merged
- Release merge commit: `66f9329182792d879dfb7bcfd2d49c6513d918b9`
- Pre-merge release verification: **Run 352**, passed on Ubuntu, Windows, and macOS-15-Intel.
- Post-merge release verification: **Run 353**, passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, full repository tests, and real-browser smoke.
- Canonical JSON / Normalization v0.1 is therefore **FROZEN**.
- `ROADMAP.md` and `README.md` were updated to record the release and activate CLI / Command Runtime.
- Duplicate Redaction PR #47 remains closed as superseded by PR #45.

## The one-current-task rule

At any moment there is exactly **one active milestone** and **one immediate next task**.

Everything else is parked in `ROADMAP.md` or an issue. New ideas do not enter the current task unless they are required to satisfy its release gate.

## Current milestone

**CLI-COMMAND-RUNTIME-V0.1-SPEC**

### Immediate next task

Freeze the public contract for a standalone native CLI / Command Runtime product:

1. define argv tokenization and strict option parsing semantics
2. define short/long flags and typed option values
3. define deterministic subcommand dispatch
4. define positional argument rules
5. define help/version rendering and deterministic output
6. define explicit stdin/stdout/stderr ownership and bounded I/O
7. define deterministic exit-code mapping
8. define explicit environment access and allowlisting
9. define typed fail-closed diagnostics without arbitrary payload copying
10. define configuration immutability and source immutability
11. define cross-platform behavior and capability limits
12. define unit, contract, integration, failure, and recovery gates
13. verify zero runtime third-party dependencies
14. write the standalone cube specification before implementation

## Scope lock

For CLI / Command Runtime Cube v0.1, the allowed scope is only:

- argv tokenization
- short and long flags
- typed option values
- deterministic subcommand routing
- positional arguments
- help and version output
- bounded argument count/token sizes
- explicit stdin/stdout/stderr handling
- bounded output sizes
- deterministic exit-code mapping
- typed fail-closed command diagnostics
- immutable configuration
- explicit environment allowlisting
- cross-platform Windows/Linux/macOS/WSL behavior where supported
- local unit/contract/integration/failure/recovery tests
- zero runtime third-party dependencies

Explicitly out of scope for v0.1:

- shell scripting language execution
- network-based command discovery
- plugin installation/package management
- terminal UI frameworks
- credential storage
- remote command execution
- third-party CLI frameworks

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

Every blocking bug or CI failure must produce all of the following before release:

- root-cause identification
- minimal fix
- regression test
- CI protection when applicable
- documentation or control update when the lesson affects future work

## Clean-repository rule

`main` is the product branch. Temporary verification branches and PRs must not become runtime artifacts. Release merges should prefer a clean, single-purpose history. No marker files, generated dependency trees, vendor directories, or unused compatibility layers belong in the product.

## Decision rule

When uncertain, choose the smallest implementation that satisfies the current contract and can later be replaced without breaking consumers.

## Recovery rule

If work is interrupted, read this file first, then `ROADMAP.md`, then the latest Git commit. Resume from the listed immediate next task; do not restart the project from memory.

## Release sequence

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

No step may be skipped by calling the project complete early.
