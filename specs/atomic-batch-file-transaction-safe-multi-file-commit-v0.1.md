# Atomic Batch File Transaction / Safe Multi-File Commit v0.1

## Status

SPEC frozen for implementation.

## Purpose

Provide a standalone, dependency-free local-filesystem primitive for applying a bounded batch of file creates, replacements, and deletions with deterministic planning, owned temporary resources, best-effort rollback, explicit recovery state, and integrity-protected immutable receipts.

This cube is not a distributed transaction system and must not claim cross-device, cross-filesystem, remote-filesystem, or power-loss atomicity that the underlying platform cannot guarantee.

## Goals

- Validate the complete transaction plan before mutating the destination set.
- Reject unsafe paths, duplicate destinations, unsupported operations, and malformed inputs before mutation.
- Keep all owned temporary resources under a dedicated transaction workspace.
- Ensure no destination is modified by a failed preflight.
- Apply operations in a deterministic canonical order.
- Detect and report partial application explicitly when the underlying filesystem cannot provide stronger guarantees.
- Perform bounded rollback for operations whose prior state was captured safely.
- Make cleanup/recovery idempotent and safe after interruption.
- Produce immutable deterministic transaction and recovery receipts.
- Protect serialized receipts with integrity checks.
- Keep diagnostics bounded and privacy-safe.
- Remain zero-runtime-dependency and cross-platform within the supported local-filesystem capability set.

## Non-goals

- Distributed two-phase commit.
- Database-backed transactions.
- Cross-host coordination.
- Guaranteed power-loss atomicity for arbitrary filesystems.
- Atomic replacement across filesystem/device boundaries.
- Automatic recovery of data that was never durably captured by the caller or underlying filesystem.

## Public surface

Primary entry points:

- `planBatch(input, capabilities, options)`
- `commitBatch(plan, capabilities, options)`
- `rollbackBatch(receipt, capabilities, options)`
- `recoverBatch(transactionId, capabilities, options)`
- `serializeReceipt(receipt)`
- `parseReceipt(serialized)`

All returned objects must be deeply immutable.

## Transaction input

A plan contains:

- transaction id
- absolute root
- bounded list of operations
- transaction policy
- optional deterministic metadata

Supported operations:

- `create`: create a new regular file from bounded bytes or a bounded source capability.
- `replace`: replace an existing regular file while retaining sufficient previous-state metadata for the selected rollback policy.
- `delete`: remove an existing regular file only when the delete policy allows it.

Each operation contains:

- destination relative path
- operation type
- expected precondition metadata when supplied
- bounded content/source descriptor for create/replace
- per-operation policy overrides only where explicitly allowed

Directories, device nodes, sockets, hard links, and arbitrary special files are unsupported in v0.1.

## Path and containment policy

- Every destination is resolved relative to an explicit absolute transaction root.
- Safe Path Resolver semantics are normative.
- Path traversal, drive-relative paths, root mismatch, namespace-root mismatch, and sibling-prefix escapes fail closed.
- Symlink destinations are rejected by default.
- A `follow-contained` policy may be supported only when the capability set can prove canonical containment and bounded symlink depth.
- A transaction must not mutate anything outside its root.
- Destination identity is canonicalized before duplicate detection.

## Preflight

Preflight must complete before any destination mutation and must validate:

- input shape and bounds
- transaction id format
- root validity
- operation count and total content limits
- destination containment
- duplicate destination identities
- unsupported operation types
- destination kind expectations
- source capability validity
- expected preconditions
- same-device/filesystem requirements where required by the selected atomicity policy
- availability of required capabilities

A failed preflight produces no destination mutation.

## Deterministic planning

Operations are canonicalized by:

1. destination relative path using the repository's platform-independent lexical comparator
2. operation precedence where required by type
3. stable operation id as final tie-breaker

The serialized plan must be identical for logically identical input regardless of caller object insertion order.

## Temporary workspace

Every transaction that needs staging owns a dedicated private workspace.

Rules:

- workspace identity is deterministic only when an injected identity capability is provided; otherwise it may be unique and volatile.
- every temporary file must be created exclusively inside the workspace.
- temporary names must be bounded and non-guessable when native randomness is available.
- cleanup must never follow a symlink out of the workspace.
- cleanup is idempotent.

## Commit model

The implementation must expose the strongest guarantee supported by the capability profile.

### Strong local mode

Supported when all affected destinations and staging resources are on the same supported local filesystem and the capability set provides safe rename/replace primitives:

- stage all new bytes first
- capture required previous state
- perform deterministic swaps/replacements
- remove staged artifacts after successful commit

### Best-effort local mode

When strong local mode is unavailable:

- preflight reports the weaker mode explicitly
- receipt records the guarantee level
- partial failure is represented explicitly
- rollback is attempted only for operations for which safe prior state exists

The API must never silently upgrade a weaker capability into an atomicity claim.

## Failure and rollback semantics

Possible terminal states:

- `planned`
- `committed`
- `rolled_back`
- `partially_committed`
- `recovery_required`
- `failed_preflight`
- `failed_commit`
- `failed_rollback`
- `unsupported_guarantee`

Rollback rules:

- rollback is best-effort and bounded.
- a successful rollback produces `rolled_back`.
- any unreverted destination produces `recovery_required` or `partially_committed` depending on what is known.
- rollback must never delete or overwrite an object whose current identity no longer matches the transaction's ownership/precondition record.
- a successor transaction must not be mistaken for the original owner.

## Recovery

`recoverBatch()` is idempotent and authority-bound.

Recovery must verify:

- transaction id
- receipt integrity
- workspace ownership
- destination ownership/preconditions
- transaction state
- capability support

Recovered state must distinguish:

- safely removable orphan temporary files
- completed operations
- incomplete operations
- uncertain operations requiring explicit operator intervention

If the system cannot safely decide, it must fail closed with a typed recovery-required result rather than guessing.

## Resource limits

Finite defaults are required for:

- max operations
- max total input bytes
- max single-file bytes
- max path length
- max metadata size
- max transaction receipt size
- max workspace entries
- max rollback actions
- max recovery scan work
- max diagnostic bytes

All limits must be checked before corresponding unbounded work.

## Capability seams

Executable capabilities must remain separate from plain configuration data.

Expected seams include:

- `lstat`
- `stat`
- `mkdir`
- `open`
- `read`
- `write`
- `rename`
- `unlink`
- `fsync` when supported
- `realpath`
- `readlink`
- `clock`
- `identity`
- optional failure injection for tests

Getter/accessor-backed configuration must be rejected before getter execution. Capability functions must never be recursively traversed, frozen, serialized, or treated as data.

## Preconditions and concurrency

Each mutating operation may carry an expected identity/version precondition.

When a destination changes after preflight and before commit:

- the operation must fail closed with a typed precondition error unless the policy explicitly permits last-writer replacement.
- the transaction must not clobber an unrelated successor object.

Concurrent transactions targeting identical destination identities must not both claim successful ownership.

## Integrity-protected receipts

Receipt serialization format: `ABT1`.

Receipt digest:

`SHA-256("ABT1|1|<canonical-payload>")`

Parsing must:

- enforce maximum serialized size before parsing
- reject malformed envelopes
- reject unsupported/future versions
- verify integrity with constant-time comparison
- deep-freeze the parsed receipt
- avoid copying arbitrary native exception messages into diagnostics

## Privacy

Receipts and errors must not include:

- file contents
- environment variables
- usernames
- access tokens
- arbitrary capability payloads
- raw OS exception messages when they may contain sensitive paths or host details

Paths may be represented relative to the transaction root where possible.

## Cross-platform policy

Normative targets:

- Linux local filesystems
- Windows local filesystems, including explicit drive/UNC/root semantics
- macOS local filesystems
- WSL where the underlying capability profile supports the requested guarantee

The implementation must report `unsupported_guarantee` when required filesystem semantics cannot be established.

## Crash/interruption boundary

A process crash may leave staged artifacts or partially applied operations.

The cube must:

- persist sufficient recovery metadata before any irreversible step when strong/recoverable mode is selected
- leave an explicit recovery receipt/state when possible
- never claim automatic rollback beyond what can be established from persisted ownership/precondition metadata

Power-loss durability is only claimed when the supplied capabilities prove the relevant persistence primitives. Otherwise the receipt must expose `durability: best-effort`.

## Testing contract

Minimum required coverage:

- deterministic planning
- empty and maximal plans
- duplicate destinations
- containment/traversal/symlink policies
- preflight no-mutation guarantee
- create/replace/delete success paths
- partial commit injection
- rollback success/failure
- successor/concurrent transaction protection
- crash/interruption recovery fixture
- workspace cleanup and orphan cleanup
- cross-device/unsupported-guarantee behavior
- capability accessor safety
- bounded resource behavior
- serialization determinism
- receipt tamper detection
- malformed/oversized receipt rejection
- immutable outputs
- privacy-safe diagnostics
- Windows drive/UNC/namespace semantics
- Linux/macOS native filesystem smoke tests

## Documentation contract

The cube must ship with:

- README
- API examples
- failure/recovery examples
- explicit guarantee matrix
- platform support notes
- unsupported-case notes
- deterministic serialization format notes
- changelog entry

## Release gate

The cube is not released until:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

has been completed on supported platforms, with no known deterministic defects and with all weaker filesystem guarantees explicitly surfaced rather than hidden.
