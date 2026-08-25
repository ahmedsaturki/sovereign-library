# Atomic File Writer / Safe Replace v0.1

## Status

SPEC — standalone product contract. Implementation begins only after this SPEC is committed and the project control plane names it as the immediate next task.

## Product boundary

A standalone, dependency-free local primitive for safely replacing the contents of **one destination file** from caller-supplied bytes or an explicit writer function.

The cube writes a complete candidate file in the destination directory, optionally verifies a caller-specified digest, then replaces the destination using a native same-filesystem rename/replace primitive where supported.

The cube does not provide general synchronization, directory-tree transactions, advisory locking, file watching, process execution, cloud/object storage, databases, or content parsing.

## Primary use cases

- crash-conscious configuration writes
- generated manifests and indexes
- local checkpoints and state snapshots
- generated application metadata
- downloaded/generated artifact staging before activation
- deterministic test fixture replacement

## Public API

Equivalent JavaScript API is required:

```js
await writeFileAtomic(path, data, options)
```

An optional stream/writer form may be exposed:

```js
await writeFileAtomic(path, async (writer) => {
  await writer.write(chunkA)
  await writer.write(chunkB)
}, options)
```

The core result must be a deterministic immutable report containing the destination path, candidate byte count, optional verified digest, replacement status, and any explicit durability limitation.

## Atomicity contract

The primary guarantee is **single-destination replacement atomicity**, not universal filesystem durability.

Required sequence:

1. validate and normalize the destination path without following unsafe caller-controlled indirection
2. identify the destination directory
3. create a unique temporary candidate **inside the same destination directory**
4. write all candidate bytes to the temporary file
5. close the candidate before replacement
6. optionally compute and verify the candidate digest
7. apply the requested mode/permission policy
8. atomically replace the destination with the completed candidate using a native rename/replace operation when supported
9. clean up the candidate only when replacement did not succeed and only when its identity is still owned by this operation

The implementation must never expose the destination as partially written during a successful replacement operation.

## Same-filesystem requirement

Temporary candidates must be created in the destination directory so that normal replacement occurs within one filesystem.

The cube must explicitly detect or surface cross-device conditions when the caller injects a custom filesystem capability or attempts an unsupported path arrangement.

It must **not** fall back to copy-then-delete because that would violate the atomic replacement contract.

## Durability boundary

The cube must distinguish:

- replacement atomicity
- data persistence to the filesystem
- directory-entry durability

A successful replacement does not imply crash-durable persistence unless the underlying platform/filesystem primitives used by the implementation establish it.

An optional durability mode may be exposed only when it maps to explicit standard-library capabilities. Unsupported durability requests must fail with a stable typed error rather than silently claiming durability.

## Existing destination behavior

The default operation replaces an existing regular file.

The cube must define explicit behavior for:

- destination absent
- destination is a directory
- destination is a symbolic link
- destination is a non-regular special file
- destination permissions deny replacement
- destination disappears between validation and replacement

The implementation must not follow a destination symlink to an unrelated target by default.

## Temporary candidate identity

Temporary names must be generated with a capability that does not rely solely on wall-clock time.

Candidate names must:

- remain bounded
- be unique enough for concurrent writers
- remain inside the destination directory
- use a recognizable but non-conflicting internal prefix
- never be derived directly from untrusted content

## Data input

`data` may be a string, Buffer/Uint8Array, or another explicitly supported byte source.

Inputs must be finite and bounded.

If a writer callback is supported, the writer capability itself is not treated as JSON data and must be validated by shape rather than recursively traversed or frozen.

The cube must never silently coerce objects to strings.

## Digest verification

Optional caller-supplied digest verification may be supported:

```js
{ digest: "sha256:<64 lowercase hex characters>" }
```

When supplied:

- the candidate digest is computed over exactly the bytes written
- mismatch fails before replacement
- the existing destination is left untouched
- the temporary candidate is cleaned up only if ownership remains provable

Digest verification is validation, not signing or trust establishment.

## Permission / mode policy

The default mode policy must be explicit and documented per platform.

Possible policies:

- `preserve-existing`: preserve supported permission bits when replacing an existing regular file
- `explicit`: apply caller-provided mode where supported
- `default`: use the platform/runtime default for the new file

Unsupported permission operations must produce a stable typed outcome or error; the cube must not claim cross-platform equivalence where none exists.

## Failure and recovery semantics

The core is fail-closed:

- a failed candidate write must not modify the existing destination
- a digest mismatch must not modify the existing destination
- a rename/replace failure must leave the existing destination unchanged when the platform guarantees that failure semantics
- candidate cleanup is best-effort but bounded and must never remove a path that can no longer be proven to belong to the current operation
- a cleanup failure must be reported separately from a successful destination replacement
- repeated cleanup of a known candidate path is idempotent when ownership remains provable

## Path and symlink safety

The destination path is normalized before mutation.

The default policy is:

- destination parent must resolve to a directory
- destination must not be a symlink unless an explicit opt-in policy says otherwise
- candidate creation must occur directly under the validated destination directory
- candidate cleanup must operate on the exact internally generated candidate path
- caller metadata/content must never influence filesystem paths

The cube must document platform-specific differences in symlink and rename behavior.

## Concurrency semantics

Multiple independent callers may race to replace the same destination.

The cube guarantees that each individual successful replacement is atomic at the filesystem primitive boundary; it does **not** guarantee last-writer ordering or mutual exclusion between independent callers.

No advisory locking is built into this cube.

## Error model

Typed immutable errors must cover at minimum:

- invalid destination
- unsupported input
- permission denied
- destination is not a regular file/allowed target
- unsafe symlink
- temporary candidate creation failure
- candidate write failure
- digest mismatch
- cross-device replacement
- replacement failure
- durability mode unsupported
- candidate cleanup failure
- path/record/input limit exceeded
- invalid capability seam

Raw OS exception objects must not leak into the stable public error contract.

## Operation report

A successful report should contain:

- format/version
- normalized destination path
- candidate byte count
- optional verified digest
- whether the destination previously existed
- replacement status
- requested durability mode and explicit supported/unsupported status

The report must be immutable and deterministic apart from explicit environmental fields.

## Deterministic test seams

Tests must permit injection of:

- filesystem capability object
- identity/random candidate-name generator
- digest implementation where useful
- optional clock for timestamped reports

These are execution capabilities, not ordinary data configuration.

## Limits

Finite defaults and maxima are required for:

- destination path length
- candidate-name length
- maximum bytes accepted by the non-streaming form
- optional metadata size
- maximum cleanup attempts
- writer chunk size when bounded buffering is required

The implementation must not create unbounded in-memory buffers for the streaming form.

## Cross-platform requirements

Verification targets:

- Ubuntu latest
- Windows latest
- macOS-15-Intel
- WSL where filesystem semantics differ materially

The product must document what is guaranteed by the Node.js standard library on each platform instead of presenting false equivalence.

## Dependency boundary

Zero runtime third-party dependencies.

Node.js standard-library facilities are allowed for filesystem operations, path handling, hashing, temporary naming, and platform-aware replacement.

## Required release tests

Minimum coverage:

- create destination when absent
- replace existing regular file atomically
- successful replacement leaves complete bytes only
- concurrent writers never produce partial file contents
- candidate remains inside destination directory
- digest success and mismatch behavior
- existing destination unchanged after candidate write failure
- existing destination unchanged after digest mismatch
- cross-device replacement is rejected rather than copied
- destination symlink rejection
- destination directory/special-file rejection
- permission failure behavior
- repeated cleanup idempotency
- cleanup failure reporting
- temporary candidate collision/retry
- malformed/accessor/circular/oversized input rejection
- capability seam validation
- mode policy behavior on supported platforms
- explicit unsupported durability behavior
- independent recovery after failed write
- Ubuntu, Windows, and macOS-15-Intel native smoke verification

## Out of scope

- directory-tree transactions
- filesystem watching
- advisory locking
- file synchronization
- process execution
- network/cloud/object storage
- databases
- content parsing
- encryption/signing
- distributed consensus

## Definition of done

The cube is releasable only after:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

plus public API documentation, runnable example, package registration, deterministic failure/recovery tests, cross-platform verification, and zero runtime third-party dependencies.