# Release / Verification Harness Cube v0.1

## Contract

A standalone deterministic local harness that executes explicit verification stages and returns an immutable release verdict.

Each stage has an id, a safe executable, explicit args, optional cwd/env allowlist, timeout, retry count, and `required` flag.

## Safety

- no shell execution
- executable must be a simple command name/path without shell metacharacters
- bounded stdout/stderr capture
- bounded stage count and diagnostics
- fail-closed malformed/accessor/circular definitions

## Lifecycle

Stage states: `pending`, `running`, `passed`, `failed`, `timed_out`, `cancelled`, `skipped`.

Verdict: `passed` when all required stages pass; `failed` otherwise.

## Recovery

A failed/timed-out stage retries up to its explicit retry limit. Cancellation is terminal and prevents later work.

## Definition of done

Standalone core, README, example, tests, failure/recovery coverage, package registration, and Ubuntu/Windows/macOS verification with browser smoke.
