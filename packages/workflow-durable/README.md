# Sovereign Library — Workflow / Durable Orchestration Cube v0.1

Standalone deterministic in-process workflow engine with replayable execution history.

## Features

- task, bounded parallel, and conditional steps
- deterministic state transitions and history
- retries and bounded step timeouts
- cancellation propagation
- deterministic idempotency keys
- replay validation
- immutable execution snapshots/history
- transactional failure semantics
- zero runtime third-party dependencies

## Scope

Local in-process orchestration only. No network workers, external durable stores, queues, cron, visual editors, BPMN, third-party engines, or learned planning.
