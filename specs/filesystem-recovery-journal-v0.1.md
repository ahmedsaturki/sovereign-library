# Filesystem Recovery Journal / Operation Ledger v0.1 — Specification

## Status

**SPEC-FROZEN** on `feat/filesystem-recovery-journal-v0-1`.
Implementation may begin only from this contract.

## Product goal

Provide a standalone, dependency-free local recovery journal for bounded filesystem operations. The journal records explicit operation intent, lifecycle transitions, recovery evidence, and terminal outcome so a caller can inspect and deterministically decide whether an interrupted operation is recoverable.

The cube is a **journal and recovery-decision primitive**, not a transaction engine and not an automatic repair daemon.

## Non-goals

- No automatic filesystem mutation during recovery inspection.
- No implicit replay of arbitrary commands.
- No distributed consensus or distributed locking.
- No universal crash-durability guarantee.
- No network, database, cloud service, GUI, scheduler, or third-party SDK.
- No replacement for Atomic File Writer, Atomic Batch Transaction, File Lease, or Safe File Quarantine.

## Public contract

### Journal creation

`createRecoveryJournal(options, capabilities)` creates a bounded journal with immutable journal identity and an explicit storage location/capability.

### Operation lifecycle

`beginOperation(journal, intent)` records an explicit operation intent.

`recordTransition(journal, operationId, transition)` appends a deterministic lifecycle transition.

`recordRecoveryObservation(journal, operationId, observation)` appends bounded evidence supplied by the caller.

`completeOperation(journal, operationId, outcome)` records the terminal result.

### Recovery inspection

`inspectRecoverable(journal, options)` returns immutable deterministic candidates that appear interrupted or incomplete according to the journal state.

`decideRecovery(journal, operationId, decision)` records an explicit caller decision such as `resume-permitted`, `rollback-required`, `manual-review`, or `discard-record`.

The core does **not** perform the selected action.

## Lifecycle

Allowed operation states:

`prepared -> started -> progressing -> succeeded`

`prepared -> started -> progressing -> failed`

`prepared -> started -> interrupted`

`prepared -> cancelled`

`started -> cancelled`

`progressing -> cancelled`

`interrupted -> recovery-decided`

`failed -> recovery-decided`

Terminal states are immutable. Invalid transitions fail closed and leave the journal unchanged.

## Intent contract

An intent is explicit and bounded. It may contain:

- stable operation identifier
- operation kind
- approved target references
- optional source references
- caller-supplied expected effect summary
- bounded actor label
- creation timestamp

The journal never executes or interprets a command payload. Paths and references are opaque data unless the caller separately validates them.

## Record integrity

Each record uses canonical deterministic serialization and contains an integrity digest over its canonical payload. Journal files use a versioned envelope `FRJ1`.

The journal must reject:

- malformed envelopes
- tampered records
- duplicate sequence numbers
- duplicate operation identifiers where uniqueness is required
- out-of-order sequence numbers
- invalid transitions
- accessor-backed input
- circular input
- unsupported values
- oversized records or journals

## Ordering

Every record has a monotonically increasing bounded sequence number within one journal. Equal sequence numbers are forbidden. Replay and inspection use sequence order only; wall-clock ordering is not trusted for correctness.

## Persistence

Persistence is append-only at the logical record level. A host filesystem adapter may use temporary-file replacement for the journal snapshot, but the core does not claim power-loss durability.

Writes must be completed before the corresponding in-memory append is considered durable from the journal's logical perspective.

On a write failure, the caller-visible journal state must not advance past the last successfully persisted sequence.

## Recovery model

Recovery inspection is read-only.

A candidate is recoverable when:

- its latest state is `prepared`, `started`, `progressing`, or `interrupted`;
- no valid terminal outcome exists;
- the record chain passes integrity and sequence validation.

Malformed or ambiguous journals fail closed rather than producing recoverable candidates.

Recovery decisions are explicit, immutable records. A second conflicting decision for the same operation fails closed unless an explicit supersession rule is part of the stored decision policy.

## Capabilities

All side effects are injectable:

- `read`
- `append` or `write`
- `replace` when snapshot persistence is selected
- `exists`
- `now`
- `identity`
- `hash`

Executable capabilities must remain separate from plain configuration data. Accessor-backed capability objects must be rejected before getter execution.

## Bounds

Default bounded limits must cover:

- maximum journal bytes
- maximum record bytes
- maximum operation count
- maximum transitions per operation
- maximum reference lengths
- maximum metadata depth
- maximum recovery observations per operation
- maximum diagnostics length
- maximum replay/recovery work units

All limits must be positive safe integers and deeply immutable.

## Privacy and diagnostics

Default diagnostics must not include file contents, raw environment identifiers, owner/group identities, or arbitrary native error text.

Errors expose stable deterministic codes plus bounded safe metadata.

## Failure semantics

Typed deterministic errors are required for:

- invalid input
- accessor input
- circular input
- unsupported capability
- malformed capability result
- journal not found
- permission denied
- journal corruption
- integrity mismatch
- sequence conflict
- duplicate operation
- invalid transition
- terminal-state mutation
- journal-size limit
- record-size limit
- recovery-work limit
- persistence failure
- cancellation

A secondary cleanup or persistence diagnostic must never replace the primary failure identity.

## Cross-platform contract

The core uses Node.js standard-library primitives only and must remain usable on Ubuntu, Windows, macOS-15-Intel, and WSL where the storage capability is supported.

Platform-specific filesystem behavior is reported as capability state; it is never fabricated.

## Required tests

- deterministic journal creation
- valid lifecycle transitions
- invalid transition rejection
- sequence ordering and duplicate rejection
- integrity verification and tamper detection
- interrupted-operation discovery
- explicit recovery decision recording
- conflicting decision rejection
- persistence failure semantics
- bounded journal/record limits
- accessor and circular input rejection
- immutable results
- recovery after malformed/corrupt tail records
- cancellation semantics
- Ubuntu, Windows, and macOS CI plus existing browser smoke gate

## Release gate

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

Release requires standalone docs, example, tests, recovery hardening, cross-platform CI, clean mainline post-merge verification, and zero runtime third-party dependencies.
