# Ephemeral Workspace / Scratch Directory v0.1

## Status

SPEC — the standalone product boundary for creating and managing short-lived local workspaces. Implementation must not begin until this contract is committed and the control plane points to it.

## Product boundary

A standalone, dependency-free primitive for safely creating an **ephemeral workspace directory**, exposing its immutable identity and bounded ownership metadata, and managing cleanup, expiry, and conservative stale/orphan recovery.

The cube creates and removes its own workspace directories. It does not parse or synchronize workspace contents, watch filesystem events, execute processes, provide locking semantics, or persist a database.

## Primary use cases

- build and compilation scratch space
- agent task isolation
- browser automation working directories
- document conversion pipelines
- temporary extraction/assembly stages
- test fixtures and deterministic sandbox directories
- one-shot local data transformation jobs

## Public API

Equivalent JavaScript API is required:

```js
const workspace = await createWorkspace(options);
await workspace.path();
await workspace.cleanup();
```

The returned workspace handle must expose immutable identity metadata and idempotent lifecycle operations. An AsyncDisposable adapter may be added without changing the core contract.

## Creation semantics

Workspace creation must be atomic with respect to the chosen parent directory.

The implementation must:

1. normalize the requested parent/root before mutation
2. enforce finite path and metadata limits
3. create a unique directory using a native atomic filesystem primitive
4. never follow or traverse caller-controlled path components merely to create uniqueness
5. fail closed when the parent cannot be safely established
6. never delete an existing unrelated directory during normal cleanup or failed creation

The preferred core primitive is a randomly named directory created directly under the validated parent using exclusive creation semantics.

## Workspace identity

Each workspace receives:

- format/version
- workspace id
- absolute normalized path
- parent path
- creation timestamp (informational)
- optional expiration timestamp
- bounded caller-supplied owner metadata

Workspace id generation must not depend solely on wall-clock time.

Timestamps are informational metadata and are never sole proof of ownership or stale recovery authority.

## Ownership metadata

Owner metadata is optional, opaque, bounded, and JSON-safe.

Unsupported values, accessors, symbols, circular structures, non-finite numbers, and oversized metadata must fail before filesystem mutation.

The metadata must not contain credentials, environment dumps, or arbitrary native exception objects.

## Lifecycle

Primary lifecycle:

`created -> creating -> active -> cleaning -> cleaned`

Failure terminal states may include:

`failed`, `expired`, `orphaned`, `unsupported`

Requirements:

- creation is single-flight per workspace request
- cleanup is idempotent
- operations after cleanup fail deterministically or return an explicit terminal result
- no new files/directories are created implicitly after cleanup
- independent workspace objects must not share poisoned state

## Cleanup semantics

Normal cleanup must remove **only the exact workspace directory owned by the workspace handle**.

The cube must refuse to recursively delete the parent directory or arbitrary paths derived from mutable caller metadata.

Cleanup must be bounded and fail closed on root/path confusion.

When the workspace directory contains files or nested directories, cleanup may recursively remove only that workspace subtree using a standard-library filesystem operation. It must never cross the configured workspace root boundary.

## Symlink and path boundary

The default policy is:

- do not follow symlinks outside the workspace boundary during workspace cleanup
- validate/normalize the parent/root before creation
- cleanup must verify that the target remains inside the workspace identity established at creation
- no attacker-controlled symlink may redirect cleanup to an unrelated location

The implementation must document platform-specific symlink behavior and use the safest available standard-library operations.

## Expiry / TTL

TTL is optional.

When configured:

- the workspace receives an expiration timestamp
- `isExpired()` or equivalent status evaluation is deterministic and side-effect free
- expiry does not automatically delete files merely because wall-clock time has passed
- cleanup after expiry requires explicit invocation or an explicit recovery operation

Automatic deletion by a timer is not required and must not be the sole cleanup mechanism.

## Stale / orphan recovery

Recovery is opt-in and conservative.

The implementation may remove an orphaned workspace only when configured stale criteria are satisfied and ownership/path identity can be established safely.

A timestamp alone is insufficient to prove orphaned state.

The default is **do not automatically recover orphaned workspaces**.

A recovery operation must never delete a workspace created by another active owner when its identity cannot be distinguished safely.

## Crash semantics

The cube cannot guarantee cleanup after arbitrary process termination. It therefore treats abandoned workspaces as recoverable local state only when the configured recovery policy can establish safe ownership and staleness.

The product must not claim crash-proof or globally coordinated cleanup.

## Error model

Typed immutable errors must cover at minimum:

- invalid parent/root/path
- permission denied
- unsupported filesystem behavior
- workspace creation failure
- cleanup failure
- path escape/root mismatch
- ownership mismatch
- workspace already cleaned
- stale recovery rejected
- malformed workspace record
- integrity mismatch
- metadata/path/record limit exceeded
- invalid capability seam

Raw OS error objects must not leak into the stable public error contract.

## Workspace record

The cube may maintain a small sidecar record inside the workspace directory. If present, it must use a versioned integrity-protected format, such as `EWC1`, with standard-library SHA-256.

The record must be bounded, deterministic, and limited to identity/lifecycle metadata.

Content files created by callers are not part of the stable record contract and must never be parsed or reinterpreted by the core.

## Test seams

Deterministic tests must permit injection of:

- filesystem capability object
- clock
- random/identity generator

These are execution capabilities, not ordinary configuration data, and must be validated by shape rather than recursively traversed or frozen as JSON data.

## Limits

Finite defaults and maxima are required for:

- parent path length
- workspace id length
- owner metadata size
- sidecar record size
- workspace nesting depth used by cleanup
- stale/recovery thresholds

No unbounded polling or recursive traversal may occur.

## Security requirements

- creation must not permit parent traversal outside the configured creation root
- workspace paths must be normalized before use
- cleanup must operate only on the recorded workspace identity
- owner metadata must be bounded and sanitized
- symlink behavior must be explicit
- stale recovery must not trust timestamps alone
- no credentials or secrets are written by the core
- no network or external service is required

## Cross-platform requirements

Verification targets:

- Ubuntu latest
- Windows latest
- macOS-15-Intel
- WSL where filesystem boundaries are relevant

The contract must document platform-specific filesystem behavior rather than presenting false equivalence.

## Dependency boundary

Zero runtime third-party dependencies.

Node.js standard-library facilities are allowed for filesystem operations, path handling, hashing, randomness/identity, and time.

## Deterministic test coverage

Minimum release coverage:

- normal creation and cleanup
- concurrent creation uniqueness
- immutable identity snapshots
- repeated cleanup idempotency
- nested-content cleanup confined to workspace
- path traversal/root mismatch rejection
- symlink boundary protection
- TTL status behavior
- stale/orphan recovery disabled by default
- conservative recovery positive/negative cases
- malformed/tampered records
- accessor/circular/oversized input rejection
- capability seam validation
- recovery after independent failed creation
- cross-platform native smoke tests

## Out of scope

- advisory/resource locking
- file watching
- file synchronization
- process execution
- network storage
- databases
- cloud cleanup brokers
- content parsing
- GUI/admin UI
- distributed consensus

## Definition of done

The cube is releasable only after:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

plus public API documentation, runnable example, package registration, deterministic failure/recovery tests, native cross-platform verification, and zero runtime third-party dependencies.