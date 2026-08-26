# Application Lifecycle / Graceful Shutdown Coordinator v0.1

## Status

**FROZEN SPEC — implementation may proceed only within this scope.**

## Problem

The repository contains several independent lifecycle-aware cubes (`http-server`, `worker-pool`, `scheduler`, `process-supervisor`, and others), but no application-level coordinator that owns an ordered, bounded shutdown transaction across independently registered resources.

This cube provides only the coordination boundary. Individual resources remain owners of their own close/drain semantics.

## Goals

- Register bounded lifecycle participants with deterministic priority/order.
- Support explicit application states: `idle`, `running`, `stopping`, `stopped`, `failed`, `closed`.
- Execute graceful shutdown in deterministic phases.
- Apply one overall deadline budget to the shutdown transaction.
- Support per-participant timeout within the remaining global budget.
- Stop starting new participant work once the global deadline is exhausted.
- Capture bounded participant outcomes and diagnostics.
- Support idempotent repeated shutdown calls.
- Support cancellation without orphaned timers/listeners.
- Preserve participant capabilities as executable hooks, separate from plain configuration data.
- Expose immutable lifecycle snapshots and typed errors.
- Remain dependency-free at runtime.

## Non-goals

- Owning the internal close logic of any participant.
- Process tree orchestration.
- Distributed shutdown coordination.
- Persistence or recovery journals.
- OS service-manager integration.
- Automatic restart after shutdown begins.
- Arbitrary dependency graphs between participants.
- Hidden background work after the coordinator reaches a terminal state.

## Participant contract

A participant registration contains bounded data:

- stable `id`;
- deterministic `priority` or order;
- optional `timeoutMs`;
- lifecycle metadata kept small and privacy-safe.

The executable `close`, `drain`, or equivalent hook is supplied through a capability seam and must not be traversed or frozen as configuration data.

Participants are invoked at most once per shutdown attempt.

## Ordering

Participants are ordered deterministically by:

1. explicit priority (descending or configured policy);
2. stable registration sequence;
3. stable participant id as final tie-breaker.

No ordering may depend on object insertion order outside the explicit registration sequence.

## Shutdown transaction

A shutdown call:

1. captures the current participant set;
2. transitions the coordinator to `stopping`;
3. starts participants in deterministic order;
4. gives each participant no more time than the remaining global budget and its own bounded timeout;
5. records `succeeded`, `timed_out`, `failed`, `cancelled`, or `skipped_deadline` outcome;
6. finishes as `stopped` only when all eligible participants have terminal outcomes;
7. finishes as `failed` if the coordinator contract cannot complete cleanly;
8. never launches a new participant after the global deadline is exhausted.

A participant failure does not silently erase earlier outcomes. The coordinator must preserve bounded evidence while continuing according to the configured fail-fast/continue policy.

## Deadline semantics

- Global deadline is monotonic relative to an injected clock/runtime clock.
- Participant timeouts are clamped to remaining global budget.
- A child timeout cannot extend the global deadline.
- Already-expired shutdown requests fail before participant execution.

## Cancellation semantics

- Pre-aborted shutdown fails before participant execution.
- Active cancellation stops admission of new participants.
- In-flight participant cancellation is surfaced as a typed outcome/error according to the configured policy.
- Owned timers/listeners are cleaned up.

## Idempotence and concurrency

- Only one shutdown transaction may be active per coordinator.
- Concurrent shutdown callers join the same transaction or receive the same terminal result; they must not create duplicate participant invocations.
- Repeated shutdown after `stopped` returns the immutable terminal snapshot.
- `close()` is terminal and prevents later registration or shutdown mutations.

## Registration rules

- Duplicate participant ids are rejected.
- Registration after `stopping` begins is rejected.
- Registration inputs reject accessor-backed values, circular values, unsupported types, and unsafe bounds before capability execution.
- Participant count, id length, diagnostic size, and metadata size are bounded.

## Failure surface

Typed failures must distinguish at minimum:

- invalid input/configuration;
- duplicate participant;
- coordinator busy;
- coordinator closed;
- invalid lifecycle transition;
- shutdown deadline exceeded;
- participant timeout;
- participant failure;
- cancellation;
- capability failure;
- bounds exceeded.

Diagnostics must be bounded and privacy-safe.

## Snapshot contract

Snapshots include only bounded public state:

- coordinator state;
- active shutdown identity;
- participant counts;
- per-participant terminal outcome summary;
- remaining global time when available;
- aggregate success/failure/timeout counts;
- bounded last diagnostic.

Snapshots are deeply immutable.

## Safety invariants

- No participant is invoked twice in the same transaction.
- No new participant begins after global deadline exhaustion.
- No hidden mutation occurs during inspection.
- No runtime third-party dependency is introduced.
- Participant executable hooks are never copied into error payloads or snapshots.
- A late completion from a timed-out participant cannot mutate a newer shutdown transaction.

## Test requirements

The implementation must include tests for:

- registration, duplicate rejection, and lifecycle transitions;
- deterministic ordering and tie-breaking;
- successful multi-participant shutdown;
- global deadline clamping;
- per-participant timeout;
- fail-fast vs continue policy;
- cancellation before and during shutdown;
- concurrent callers sharing one transaction;
- repeated idempotent shutdown;
- late participant completion / stale transaction protection;
- bounds and privacy-safe diagnostics;
- accessor/circular input rejection;
- capability injection;
- immutable snapshots/errors;
- native smoke behavior on Ubuntu, Windows, and macOS-15-Intel.

## Release gate

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE`

No other cube may be developed concurrently.