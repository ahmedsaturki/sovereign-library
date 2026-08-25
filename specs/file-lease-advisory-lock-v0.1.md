# File Lease / Advisory Lock v0.1

## Status

SPEC — the standalone product boundary for a cross-platform advisory file lease. Implementation must preserve this contract and may extend it only when required for the release gate.

## Product boundary

A standalone, dependency-free primitive for obtaining and releasing an **advisory lease** associated with a filesystem path. The lease coordinates cooperating processes or agents that agree to honor the same lease protocol.

The cube does not provide mandatory kernel-wide serialization against arbitrary programs that ignore the protocol. It does not modify the protected target's contents, execute commands, contact a network service, or persist a database.

## Primary use cases

- single-instance application/process guards
- cooperative job exclusion
- agent/workspace ownership
- build/output coordination
- local migration guards
- temporary maintenance locks
- preventing duplicate workers from claiming the same logical resource

## Public API

Equivalent JavaScript API is required:

```js
const lease = await acquireLease(path, options);
await lease.renew();
await lease.release();
```

The acquisition operation must return an immutable lease identity containing a stable lease id, lock path, owner metadata bounded by contract, acquisition state, and an explicit expiration/renewal policy when enabled.

## Lock representation

The default protocol uses a dedicated lock sidecar path derived from the requested resource path. The cube must never overwrite the protected resource merely to acquire a lease.

The lock representation must contain only bounded protocol metadata required to identify the lease and perform safe recovery. It must not store credentials, arbitrary environment dumps, or unbounded caller data.

## Acquisition modes

Supported acquisition outcomes:

- `acquired`: lease ownership successfully established
- `busy`: an active compatible lease already owns the lock
- `stale_recoverable`: previous lease metadata is demonstrably stale and safe recovery is permitted
- `failed`: acquisition could not safely determine or establish ownership

The implementation must use atomic filesystem primitives available from the Node.js standard library and must fail closed when atomic ownership cannot be established.

## Atomicity boundary

Two cooperating contenders racing to acquire the same lease must not both receive `acquired` for the same lock identity.

The implementation must not use a read-then-write sequence as its sole ownership guarantee.

When the host filesystem cannot provide the required atomic primitive, acquisition must fail with a typed unsupported/unsafe error rather than pretending that a lease was acquired.

## Lease identity

Each successful acquisition receives a unique lease id generated without using the system clock as the sole uniqueness source.

Lease identity includes:

- format version
- lease id
- lock path
- owner id (optional, bounded)
- acquired-at timestamp (informational)
- expiration timestamp only when TTL/renewal is configured

The cube must never treat timestamps alone as ownership proof.

## Owner metadata

Owner metadata is optional and opaque but bounded. It may contain a caller-supplied process/agent label and bounded diagnostic fields.

Unsupported values, accessors, symbols, circular structures, oversized metadata, and non-finite numbers must fail before filesystem mutation.

## TTL and renewal

TTL is opt-in.

When configured:

- the lease has a finite expiration deadline
- `renew()` extends the lease only when the current lease id still owns the lock
- renewal must verify ownership before modifying metadata
- an expired lease must not be renewed as though it were still valid
- renewal failure transitions the lease to a terminal non-owner state

Without TTL, the lease remains valid until explicit `release()` or an unrecoverable filesystem failure.

The cube must never rely on timers alone to prove that a lease is expired; timestamps are advisory metadata, while ownership is established by the lease record and atomic filesystem rules.

## Stale recovery

Stale recovery is opt-in and conservative.

The implementation may recover a lock only when all configured stale criteria are satisfied and the recovery step itself is atomic.

A stale timestamp alone is insufficient if ownership cannot be safely distinguished from a live but delayed process.

The default is **do not recover automatically**.

## Release

`release()` is idempotent for the current lease.

Release must remove only the exact lock identity owned by the caller. A lease must never delete a lock that has been replaced by another owner after an expiry/recovery race.

After release, subsequent calls to `renew()` fail deterministically with a typed state error.

## Crash and abandoned leases

The cube cannot guarantee cleanup after process termination on every platform. Therefore abandoned leases are treated as recoverable state only when the configured stale-recovery policy can establish safe ownership replacement.

The implementation must not claim crash-proof locking semantics.

## Lifecycle

States:

`created -> acquiring -> acquired -> renewing -> releasing -> released`

Failure terminal states may include:

`busy`, `expired`, `lost`, `failed`, `unsupported`

Requirements:

- acquisition is single-flight per lease object
- release is idempotent
- renew after release/expiry/loss fails deterministically
- no operation may mutate the lock after ownership is lost
- independent lease objects can recover after a failed acquisition without shared poisoned state

## Error model

Typed immutable errors must cover at minimum:

- invalid path/options
- lock busy
- unsupported filesystem atomicity
- permission denied
- malformed existing lock record
- ownership lost
- expired lease
- invalid state transition
- stale recovery rejected
- metadata limit exceeded
- serialization/integrity failure

Raw OS error objects must not leak into the stable public contract.

## Integrity

The lock record must be deterministic and integrity-checkable. A versioned envelope such as `FLC1` is required. Standard-library SHA-256 is sufficient.

Parsing a lock record must verify its checksum before it can influence recovery decisions.

## Security boundary

- lock paths are normalized and bounded
- path traversal is rejected when a lock root/sandbox is configured
- symlink behavior is explicit and must not permit lock confusion across an intended root boundary
- caller metadata is bounded and sanitized
- lock records contain no secrets
- recovery decisions must not trust mutable caller-supplied metadata as sole proof of ownership

## Cross-platform requirements

Verification targets:

- Ubuntu latest
- Windows latest
- macOS-15-Intel
- WSL where the watched/locked path crosses a supported filesystem boundary

The implementation must document platform-specific filesystem semantics and avoid pretending that advisory locking is identical across all filesystems.

## Dependency boundary

Zero runtime third-party dependencies.

Node.js standard-library facilities are allowed: filesystem primitives, path utilities, cryptographic hashing, random/uuid primitives, and timers.

## Limits

Finite defaults and maxima are required for:

- path length
- lock-record size
- owner metadata size
- stale threshold
- maximum renewal interval
- retry/contender wait duration when a bounded wait mode is exposed

No unbounded polling loop is allowed.

## Deterministic test seams

The implementation must permit deterministic injection of filesystem/time/random capabilities or an equivalent test seam without making production behavior depend on mock-only semantics.

Tests must cover:

- uncontended acquisition
- two-contender race
- busy lock
- release and reacquire
- repeated release
- renewal before expiry
- renewal after release/expiry
- ownership-loss protection
- malformed/tampered lock records
- stale recovery enabled/disabled
- permission/access failures
- accessor/circular/oversized input rejection
- recovery after independent failed acquisition
- cross-platform native smoke tests

## Out of scope

- mandatory locking against non-cooperating programs
- file content changes
- process execution
- network/distributed locks
- database locks
- cloud coordination
- service discovery
- GUI/admin UI
- cluster-wide consensus
- automatic process termination

## Definition of done

The cube is releasable only after:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

with documentation, runnable example, package registration, deterministic contract/failure tests, cross-platform native verification, and zero runtime third-party dependencies.