# Workflow / Durable Orchestration Cube v0.1

## Product goal

Standalone native local workflow engine for deterministic in-process orchestration. It must support sequential, bounded parallel, and conditional steps; replayable execution history; retries, timeouts, cancellation, idempotency; immutable snapshots/results; bounded work/history; crash/restart recovery semantics; and zero runtime third-party dependencies.

## Workflow model

```js
{
  id: string,
  version: string,
  steps: [
    { id: string, kind: 'task'|'parallel'|'if', ... }
  ]
}
```

Step ids are unique and stable. Task handlers are supplied by trusted host code and are invoked through a strict execution context.

## State machine

Workflow states:
`PENDING -> RUNNING -> SUCCEEDED`
`PENDING -> RUNNING -> FAILED`
`PENDING -> RUNNING -> CANCELED`
`FAILED -> RETRY_WAIT -> RUNNING` when retry policy permits.

Parallel children have independent child states while the parent remains RUNNING until join semantics are satisfied.

## Determinism

- step traversal follows definition order
- parallel completion is recorded by deterministic logical step id ordering, not wall-clock completion order
- conditional branch evaluation is explicit and recorded in history
- retry attempt numbers and deadlines are explicit history fields
- generated execution and step keys are stable from workflow id/version/execution id/step id/attempt

## History

Each execution maintains append-only logical history entries:

```js
{
  seq,
  type,
  executionId,
  stepId,
  attempt,
  timestamp,
  payload
}
```

Timestamps are observational only and never determine logical ordering. Replays consume logical history and never re-run already-recorded successful idempotent steps.

## Step composition

- task: one trusted handler
- parallel: bounded child task set with deterministic join
- if: explicit predicate result selects one branch
- nesting depth and fan-out are bounded

## Retry / timeout / cancellation

- per-task retry count and bounded backoff policy
- task deadlines are monotonic-clock based
- AbortSignal cancellation propagates to active child work
- a canceled execution never resumes automatically
- failed retries record all attempts before final failure
- compensation hooks are out of scope for v0.1 unless represented as ordinary explicit steps

## Idempotency

Each step attempt has a deterministic execution key. Hosts may use this key to make side effects idempotent. The cube itself does not provide external transactional side effects.

## Bounds

Safe finite limits for:

- workflow definition size
- step count
- nesting depth
- parallel fan-out
- execution history entries
- per-entry payload bytes
- total history bytes
- retry attempts
- step timeout/deadline window
- replay work

Bounds are checked before expensive operations where practical.

## Immutability and recovery

- workflow definitions are validated and immutable after creation
- execution snapshots/results are immutable
- host input payloads are never mutated
- invalid transitions fail without corrupting prior state
- failed steps preserve valid history
- restart/replay uses history to reconstruct deterministic state
- replay failure leaves the previously valid snapshot untouched

## Errors

Stable typed `WorkflowError` codes:

- `INVALID_CONFIG`
- `INVALID_WORKFLOW`
- `DUPLICATE_STEP`
- `INVALID_TRANSITION`
- `STEP_FAILURE`
- `STEP_TIMEOUT`
- `CANCELED`
- `RETRY_EXHAUSTED`
- `HISTORY_LIMIT`
- `REPLAY_FAILURE`
- `IDEMPOTENCY_CONFLICT`

Diagnostics may contain safe ids, states, counts, and bounded codes, but not arbitrary payload copies.

## Public API target

```js
const engine = createWorkflowEngine(config);
const workflow = engine.define(workflowDefinition);
const execution = engine.start(workflow, input);
execution.run();
execution.cancel();
execution.snapshot();
execution.replay(history);
engine.stats();
```

No public API exposes mutable internal state.

## Scope

In scope: local in-process workflows, deterministic state machine, sequential/bounded parallel/conditional composition, history and replay, retry/timeout/cancellation, idempotency keys, bounded fan-out/history/payloads, immutable snapshots/results, typed fail-closed diagnostics, recovery tests, cross-platform verification, zero runtime third-party dependencies.

Out of scope: network/distributed orchestration, external durable databases, cron/scheduled triggers, remote queues/workers, visual workflow editors, BPMN, third-party workflow engines, external integrations, learned planning/agents.

## Done gate

Standalone implementation, README/API docs, runnable example, normal-path tests, failure/recovery tests, deterministic replay tests, source immutability tests, supported-platform CI, real-browser smoke gate, and no blocking defects.
