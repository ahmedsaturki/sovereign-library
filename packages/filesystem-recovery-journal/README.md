# Filesystem Recovery Journal / Operation Ledger v0.1

Standalone, dependency-free journal for explicit filesystem operation intent, deterministic lifecycle transitions, recovery observations, and caller-owned recovery decisions.

## Safety boundary

The cube records state; it does not perform hidden filesystem mutation during recovery inspection or replay. A caller must separately invoke a privileged filesystem primitive such as Atomic File Writer, Atomic Batch Transaction, or Safe File Quarantine after making an explicit decision.

## API

```js
import { createRecoveryJournal } from './src/index.js';

const journal = createRecoveryJournal({ path: './runtime/recovery.frj' });
const op = await journal.beginOperation({ kind: 'file-replace', targets: ['/data/config.json'] });
await journal.transition(op.operationId, 'started');
await journal.observe(op.operationId, { stage: 'candidate-written' });
await journal.complete(op.operationId, 'succeeded', { result: 'replaced' });
```

Interrupted operations can be inspected without mutation:

```js
const recoverable = await journal.inspectRecoverable();
```

A recovery decision is recorded explicitly:

```js
await journal.decide(op.operationId, { kind: 'manual-review', reason: 'external state changed' });
```

## Integrity and bounds

Records use the versioned `FRJ1` envelope and a SHA-256 integrity digest over canonical payloads. Sequence numbers are contiguous and terminal states cannot be mutated. Record, journal, operation, transition, observation, reference, and diagnostic sizes are bounded.

## Failure/recovery behavior

Malformed or tampered records fail closed. Persistence failures do not advance the logical sequence. Recovery inspection is read-only. No arbitrary command payload is executed and no filesystem path is implicitly discovered or repaired.

## Cross-platform / dependencies

The core uses Node.js standard-library APIs only and targets Ubuntu, Windows, macOS-15-Intel, and WSL where the requested storage capability exists.
