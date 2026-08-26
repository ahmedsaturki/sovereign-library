# Process Supervisor / Managed Child Lifecycle v0.1

## Status

**FROZEN SPEC — implementation may proceed only within this scope.**

## Problem

The existing `cubes/process` primitive executes a child process and returns one terminal result. It does not own the lifecycle of a long-lived managed child, bounded restart policy, graceful-stop escalation, health observations, or supervisor-level state.

This cube adds a narrow supervisor boundary without replacing the existing process execution primitive.

## Goals

- Manage at most one active child process per supervisor instance.
- Expose a deterministic supervisor lifecycle state machine.
- Support explicit `start`, `stop`, `restart`, `inspect`, and `close` operations.
- Support graceful termination followed by bounded forced-kill escalation.
- Support bounded restart attempts with deterministic backoff.
- Track health observations without executing hidden corrective actions.
- Bound stdout/stderr accounting and diagnostic payloads.
- Preserve caller control over command, args, environment, cwd, and signals.
- Honor AbortSignal/deadline cancellation.
- Expose immutable snapshots and deterministic typed failures.
- Keep executable capabilities separate from validated data/configuration.
- Use only Node.js standard-library/runtime primitives; no runtime third-party dependencies.

## Non-goals

- Process trees or descendant orchestration.
- Shell command composition or implicit shell execution.
- Cross-host supervision.
- OS service-manager integration (systemd, launchd, Windows SCM).
- Automatic health remediation.
- Persistence or distributed leader election.
- Hidden restart loops.

## Lifecycle

Supervisor states:

- `idle`
- `starting`
- `running`
- `stopping`
- `restarting`
- `failed`
- `closed`

Allowed transitions are explicit and terminal `closed` cannot transition.

A child exit while `running` becomes a supervisor failure/exit observation. Automatic restart is permitted only when explicitly configured and only while the restart budget remains.

## Restart policy

Restart policy is opt-in and bounded:

- `enabled: false` by default.
- `maxAttempts` must be a positive safe integer when enabled.
- Backoff policy is deterministic and bounded by a configured maximum delay.
- A restart attempt consumes budget before the next child start.
- No retry after `closed` or explicit caller stop.

## Stop escalation

`stop()` is explicit and bounded:

1. request configured graceful signal (default platform-compatible termination signal);
2. wait for `gracePeriodMs`;
3. issue configured forced-kill signal if the child is still alive;
4. resolve only after a terminal child observation or return a typed escalation failure.

The supervisor must never silently escalate outside the configured bound.

## Health observation

`inspect()` is read-only and returns:

- supervisor state;
- managed child identity when available;
- current attempt number;
- last exit code/signal;
- restart attempts remaining;
- bounded stdout/stderr byte counters;
- last bounded diagnostic;
- timestamps from the injected clock/runtime clock.

Health inspection never starts, stops, or restarts the child.

## Output and diagnostics

- Output accounting is bounded before unbounded accumulation.
- Diagnostics never include arbitrary environment contents, full command secrets, or raw output payloads by default.
- Caller may request bounded output excerpts within explicit limits.

## Capability boundary

Executable capabilities (spawn, signal, clock, identity) are passed through a capability seam and are not recursively traversed, frozen, or treated as configuration data.

Configuration and operation inputs must reject accessor-backed values, circular structures, unsupported values, and unsafe bounds before any capability executes.

## Cancellation and deadlines

- Pre-aborted signals fail before spawn.
- Active cancellation requests explicit stop semantics and returns a typed cancellation result/error.
- A deadline cannot be extended by child restart or escalation.
- Cancellation must remove owned timers/listeners.

## Safety invariants

- No shell execution is introduced by the supervisor.
- No implicit restart or remediation occurs when restart is disabled.
- No operation may mutate supervisor state after `closed`.
- No second child may be started while an earlier child remains owned by the supervisor.
- A stale child-generation event must not mutate the current child state.
- Restart and stop operations are serialized per supervisor.

## Determinism and immutability

Public snapshots, policies, results, and errors are immutable.

State transitions, attempt numbering, restart decisions, and bounded diagnostics are deterministic for identical inputs and injected clocks/capabilities.

## Error surface

Typed failures must distinguish at minimum:

- invalid configuration/input
- invalid transition
- supervisor closed
- spawn failure
- already running / busy
- stop timeout / escalation failure
- restart budget exhausted
- cancellation
- deadline exceeded
- output bound exceeded
- stale child generation
- capability failure

Error details must remain bounded and privacy-safe.

## Test requirements

The implementation must include tests for:

- lifecycle transitions and illegal transitions;
- one-child ownership and busy behavior;
- graceful stop and forced escalation;
- restart budget and deterministic backoff;
- restart disabled semantics;
- stale generation events;
- health snapshots without side effects;
- output accounting and diagnostic bounds;
- accessor/circular/unsupported input rejection;
- pre-aborted and active cancellation;
- deadlines across restart/escalation;
- capability injection;
- immutable snapshots/errors;
- cross-platform smoke behavior on Ubuntu, Windows, and macOS-15-Intel.

## Release gate

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE`

No other cube may be developed concurrently.