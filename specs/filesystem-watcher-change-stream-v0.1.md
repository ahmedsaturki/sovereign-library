# Filesystem Watcher / Change Stream v0.1

## Status

SPEC — implementation must not begin before this document is reviewed and accepted by the control plane.

## Product boundary

A standalone read-only filesystem change observation cube.

The cube watches one or more explicitly configured roots and emits a normalized bounded stream of filesystem change events. It owns watcher lifecycle, event normalization, recursive-watch policy, optional debounce/coalescing, duplicate/noise suppression, queue/backpressure behavior, and deterministic test injection.

It does **not** write watched targets, execute commands, install software, change process configuration, perform synchronization, maintain a database, or depend on another Sovereign cube at runtime.

## Primary use cases

- editors reacting to file changes
- build and development tooling
- cache invalidation
- local synchronization engines
- agent/automation triggers
- indexing pipelines

## Public API shape

The exact JavaScript names may evolve during implementation, but the public contract must provide equivalents for:

```js
createWatcher(options)
watcher.start()
watcher.next()
watcher.close()
watcher.errors()
```

The implementation may additionally expose callback/AsyncIterable adapters, but the core must preserve one deterministic event contract.

## Watch configuration

Configuration contains:

- one or more absolute or explicitly rooted paths
- `recursive: boolean` with platform capability reporting
- optional include/exclude path predicates that are declarative and bounded
- optional debounce/coalescing configuration
- bounded queue capacity
- explicit overflow policy
- optional injected event source for deterministic tests

Inputs must be validated before watcher resources are allocated.

## Normalized event model

Every emitted event is immutable and contains:

- `type`: `created | changed | removed | renamed`
- `path`: normalized path relative to the watched root when a root-relative representation is possible
- `rootId`: deterministic watcher-root identity
- `observedAt`: caller/source supplied timestamp when using injected sources; native observation may use monotonic sequence ordering and must not require wall-clock truth for event correctness
- `sequence`: strictly increasing per watcher instance
- `previousPath`: present only for a normalized rename where the platform source provides enough information to establish it without inference

Rules:

1. never invent a rename when only independent remove/create evidence exists
2. never invent a change event from a directory enumeration that has not produced an actual source signal
3. preserve event order within the source ordering guarantees
4. normalize platform-specific raw action names into the four public types
5. normalize path separators to the platform-neutral public representation
6. do not expose arbitrary raw native payloads in public events

## Rename semantics

A rename is emitted only when the source can pair the old and new path explicitly. Otherwise emit the observable primitive events permitted by the platform adapter.

Cross-platform differences are part of the contract and must be documented rather than hidden behind fabricated equivalence.

## Recursive watching

Recursive watching is explicit.

- When native recursive support exists, use it directly.
- When it does not exist, the cube may maintain child watcher registrations using native facilities, subject to strict resource and depth bounds.
- The cube must report when requested recursion cannot be honored rather than silently switching semantics.
- Directory discovery must be bounded and must not imply persistence outside the active watcher.

## Symlink policy

Default behavior is **do not follow symlinks across the configured root boundary**.

The implementation must resolve only enough path information to prevent escapes from the watched root. It must never traverse an unbounded symlink graph.

Symlink behavior must be represented explicitly in the contract and tested on supported platforms.

## Path safety

- watcher roots must be normalized before activation
- emitted paths must remain rooted within the declared watch scope
- traversal and root-escape attempts fail closed
- path lengths and watcher-root counts are bounded
- no arbitrary path from a native event may bypass normalization

## Debounce and coalescing

Debounce is opt-in and deterministic.

Without debounce, source events are normalized independently except for mandatory platform-noise suppression that is explicitly documented.

With debounce:

- events are grouped only within the configured bounded interval/window
- coalescing must be deterministic
- ordering between independent paths must remain stable
- a coalesced event must not claim stronger evidence than its source events provide

The cube must expose whether an event was coalesced without leaking raw platform payloads.

## Duplicate and noise suppression

Allowed suppression is limited to known duplicates generated by the native adapter or explicitly requested coalescing rules.

The implementation must not globally deduplicate semantically distinct events merely because their paths match.

Repeated valid events must remain observable when the source contract permits them.

## Queue and backpressure

The queue is bounded.

Overflow policy must be explicit and one of:

- `reject_new`: reject newly observed events and emit a typed overflow error
- `drop_oldest`: discard the oldest queued event and emit a typed overflow diagnostic
- `drop_newest`: discard the new event and emit a typed overflow diagnostic

Default policy must be the safest least-surprising mode and documented in the implementation.

The cube must never silently grow an unbounded in-memory queue.

Overflow behavior must be observable and recoverable; after consumer recovery, later valid events can be accepted without restarting the entire process where the native adapter permits continued observation.

## Lifecycle

Watcher states:

`created -> starting -> running -> closing -> closed`

Failures may transition `starting -> closed` or `running -> closed` when native observation cannot safely continue.

Requirements:

- `start()` is idempotent only when already running; duplicate incompatible transitions fail deterministically
- `close()` is idempotent
- `next()` after `closed` returns the terminal condition without throwing unrelated state errors
- native resources are released on close
- listener/timer cleanup is deterministic
- no event may be emitted after the watcher reaches `closed`

## Errors

Errors are typed, bounded, immutable, and do not embed arbitrary native exception objects or full environment payloads.

At minimum cover:

- invalid configuration
- unsupported recursive mode
- invalid root/path
- path escape
- watcher initialization failure
- native event normalization failure
- queue overflow
- closed watcher misuse
- injected source contract failure

The cube must recover from rejected configuration/event input without poisoning future independent watcher instances.

## Deterministic test source

The core contract must support an injected event source so tests do not depend on operating-system timing or flaky filesystem notification behavior.

The injected source must allow deterministic sequences for:

- create/change/remove/rename
- duplicates/noise
- bursts
- queue overflow
- source failure
- close during delivery
- recovery after bounded failure

Platform adapters remain covered by real smoke/integration tests separately.

## Platform targets

Required verification targets:

- Ubuntu latest
- Windows latest
- macOS-15-Intel
- WSL where applicable to the host filesystem boundary

The contract must document platform-specific limitations instead of presenting false equivalence.

## Dependency boundary

Zero runtime third-party dependencies.

Use Node.js standard-library facilities such as filesystem notification APIs, path utilities, timers, and async iteration as appropriate.

No third-party watcher library may be required by the standalone core.

## Limits

The implementation must define finite defaults and maximums for:

- watch roots
- recursive discovery depth
- path length
- queue capacity
- exclude/include rule count
- debounce window
- pending timers
- event metadata size

All limits are checked before unbounded resource allocation.

## Serialization / diagnostics

The core event contract is JSON-safe and deterministic. Any optional snapshot/diagnostic serialization must be versioned, bounded, and integrity-protected, using standard-library hashing only.

Raw OS-specific event payloads must never become part of the stable serialized contract.

## Testing requirements

Minimum release coverage:

- normal lifecycle
- immutable event snapshots
- create/change/remove/rename normalization
- explicit rename semantics
- recursive mode behavior
- path containment and traversal rejection
- symlink boundary rules
- debounce/coalescing determinism
- duplicate/noise suppression
- all queue overflow policies
- source failure and recovery
- close/idempotency behavior
- deterministic injected-source tests
- malformed/accessor/circular/oversized input rejection
- cross-platform native smoke test

## Out of scope

- file synchronization
- file copying/moving as a reaction to events
- process execution
- shell commands
- networking
- persistent indexing/database storage
- cloud/event broker integration
- GUI
- telemetry uploads
- content inspection of changed files

## Definition of done

The cube is releasable only after:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

and after every supported CI job passes syntax, full repository tests, and the real-browser smoke gate, plus the cube-specific deterministic source and native filesystem watcher coverage.
