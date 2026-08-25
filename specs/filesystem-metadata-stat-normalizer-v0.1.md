# Filesystem Metadata / Stat Normalizer v0.1

## Status

SPEC — implementation must not begin until this document is committed on the control plane.

## Product boundary

Filesystem Metadata / Stat Normalizer is a standalone, dependency-free normalization primitive for converting native `lstat`/`stat` results into a stable immutable cross-platform metadata contract.

It owns:

- metadata extraction through capability seams
- stable entry-kind classification
- numeric/stat field normalization
- timestamp normalization
- permission/mode normalization where meaningful
- filesystem identity normalization where safely available
- explicit symlink follow/non-follow policy
- bounded immutable metadata objects
- privacy-safe field allowlisting
- deterministic canonical representation
- failure/recovery semantics for missing, permission-denied, malformed, and changing entries

It does not own:

- directory traversal
- tree/snapshot serialization
- path containment policy
- filesystem watching
- glob/pattern matching
- persistent storage
- content hashing
- content indexing
- filesystem mutation

## API shape

Conceptually:

```js
normalizeStat(path, options, capabilities)
normalizeEntryMetadata(rawStat, path, options)
serializeMetadata(metadata)
```

The public default operation is asynchronous because native stat access is asynchronous. Pure normalization and serialization are synchronous and deterministic.

## Entry kinds

The normalized `kind` MUST be one of:

- `file`
- `directory`
- `symlink`
- `socket`
- `block-device`
- `character-device`
- `fifo`
- `unknown`

The implementation MUST distinguish `lstat` observation from `stat` target observation explicitly.

## Symlink policy

Default: `follow: false`.

Supported policies:

- `lstat`: normalize the link itself and never inspect its target
- `stat`: normalize the resolved target through the injected `stat` capability
- `contained`: resolve and normalize the target only when an explicit caller-provided containment capability confirms it remains in scope

The cube MUST NOT implement its own path containment rules. A contained policy must consume the released Safe Path Resolver boundary through an explicit capability.

Symlink cycles or canonicalization failures MUST fail closed.

## Normalized metadata fields

The stable representation is bounded and immutable:

```text
version
path
kind
size
allocationSize
mode
readonly
uid
 gid
nlink
inode
device
birthtimeMs
ctimeMs
mtimeMs
atimeMs
isSparse
symlinkTarget
platform
observedWith
```

Field rules:

- `version` is the metadata contract version (`FMN1` payload version 1).
- `path` is caller-supplied display identity and MUST be bounded; no absolute path outside an explicitly allowed reporting policy may be copied into diagnostics.
- `kind` is the normalized entry kind.
- `size` and `allocationSize` are non-negative safe integers or `null` when unavailable.
- `mode` is a bounded non-negative integer representing permission bits where the host exposes them; otherwise `null`.
- `readonly` is boolean or `null`.
- `uid`, `gid`, `nlink`, `inode`, and `device` are non-negative safe integers or `null`.
- timestamps are integer milliseconds since Unix epoch, finite and non-negative, or `null`.
- `isSparse` is boolean or `null` and MUST never be inferred from absence of a platform field.
- `symlinkTarget` is only populated when the selected policy and capability explicitly provide it; it is bounded and normalized to a safe display representation.
- `platform` identifies only the coarse host family (`linux`, `windows`, `darwin`, `other`), never hostname/user/device identifiers.
- `observedWith` is `lstat` or `stat`.

## Numeric safety

All numeric values MUST be finite safe integers.

Any native `BigInt` or numeric value outside JavaScript safe integer range MUST either be represented as a bounded decimal string in a separately documented field or normalized to `null` with an explicit `precisionLost` flag. The default v0.1 contract chooses the latter to keep the schema stable and JSON-safe.

Negative timestamps, negative sizes, `NaN`, `Infinity`, and impossible field combinations MUST fail with typed normalization errors rather than silently wrapping or coercing.

## Mode and permissions

Mode normalization MUST preserve the numeric permission bits without host-specific textual formatting.

Windows ACLs are explicitly out of scope for v0.1. The normalized `mode` field may be `null` on Windows.

The cube MUST NOT attempt to synthesize POSIX permissions from Windows ACLs.

## Time normalization

Native Date objects and platform-specific timestamp objects MUST normalize to integer milliseconds.

Sub-millisecond precision MAY be discarded only by explicit contract.

Timezone and locale MUST never affect normalized timestamp values.

## Identity normalization

`inode`, `device`, and related filesystem identity fields are optional because their semantics vary by platform and filesystem.

The cube MUST preserve `null` when a field is not supported or not safely observable.

It MUST NOT manufacture stable identity values by hashing paths, hostnames, usernames, timestamps, or unrelated metadata.

## Privacy boundary

Default normalization MUST NOT read:

- environment variables
- current username
- hostname
- home directory
- process arguments
- network interfaces
- device serial numbers
- unrelated filesystem locations

Only the explicit `path` supplied by the caller and fields from the stat capability result may influence output.

Platform identification is coarse only (`linux`, `windows`, `darwin`, `other`).

Diagnostics MUST be bounded and MUST not copy arbitrary native stat objects into errors.

## Capability seams

Capabilities are executable hooks, never data configuration:

```js
{
  lstat(path),
  stat(path),
  readlink(path),
  now(),
  containment(path, root)
}
```

Required capabilities depend on policy:

- `lstat` is required for default/non-following mode.
- `stat` is required for target-following mode.
- `readlink` is required only when symlink target reporting is requested.
- `now` is optional and used only for diagnostic observation timestamps, not filesystem timestamps.
- `containment` is required only for the explicit `contained` symlink policy.

Capability containers MUST:

- reject accessors before evaluating getters
- reject non-function members
- reject circular/configuration traversal
- validate result shapes without freezing or cloning executable hooks
- normalize malformed native result values into typed failures

## Result bounds

Required limits:

- `maxPathLength`
- `maxSymlinkTargetLength`
- `maxMetadataBytes`
- `maxDiagnosticsLength`

Defaults MUST be finite and conservative.

Oversized paths, targets, metadata, or diagnostics MUST fail before generating an oversized serialized object.

## Deterministic representation

`serializeMetadata(metadata)` MUST:

- emit the `FMN1|1|` envelope
- use canonical JSON ordering independent of object insertion order
- omit unavailable optional fields only according to the locked schema rules
- produce identical bytes for logically identical normalized metadata
- reject unsupported JSON values, circular structures, accessors, and oversized payloads

Serialization is immutable and input-preserving.

## Failure taxonomy

At minimum:

- `INVALID_OPTIONS`
- `INVALID_PATH`
- `ACCESSOR_INPUT`
- `CAPABILITY_FAILURE`
- `MALFORMED_STAT`
- `UNSAFE_NUMBER`
- `INVALID_TIMESTAMP`
- `UNKNOWN_ENTRY_KIND`
- `PATH_LIMIT_EXCEEDED`
- `SYMLINK_TARGET_LIMIT_EXCEEDED`
- `ROOT_ESCAPE`
- `SYMLINK_CYCLE`
- `PERMISSION_DENIED`
- `NOT_FOUND`
- `CHANGED_DURING_READ`
- `SERIALIZATION_FAILURE`
- `LIMIT_EXCEEDED`

Native errors MAY be mapped into stable categories. Raw native error text MUST NOT affect deterministic equality or serialization.

## Failure/recovery semantics

A failed normalization MUST have no lasting side effects.

After a failed call, a later valid call using the same independent capability container MUST work normally.

For `NOT_FOUND`, `PERMISSION_DENIED`, and `CHANGED_DURING_READ`, the caller may explicitly choose a recovery policy:

- `throw`
- `return-null`
- `return-error`

Default is `throw`.

## Changing-entry race semantics

A filesystem entry may change between `lstat`, `readlink`, and `stat`.

The cube MUST NOT claim a single atomic observation unless the platform/capability guarantees it.

When required observations disagree materially (kind changes, symlink disappears, size/mtime changes during an explicit double-read policy), the result MUST either:

- fail with `CHANGED_DURING_READ`, or
- return a document with `consistency: 'best-effort'` when the caller explicitly selects best-effort mode.

Default is strict consistency.

## Non-mutating guarantee

The cube MUST never write, rename, delete, chmod, chown, or otherwise mutate the filesystem.

## Canonical immutability

Returned metadata objects, nested structures, diagnostics, and serialized snapshots MUST be immutable. Caller-owned input objects MUST remain unchanged.

## Cross-platform behavior

Required support:

- Ubuntu + Node 24
- Windows + Node 24
- macOS-15-Intel + Node 24
- relevant WSL verification where path or mode semantics differ materially

Platform differences MUST be represented explicitly as null/flags rather than silently converted into misleading values.

## Dependency policy

Runtime dependencies: zero third-party packages.

Allowed foundations:

- Node.js standard library
- native filesystem primitives
- released Sovereign Library cubes through explicit local imports

## Test requirements

Before release the cube MUST include tests for:

- each entry kind
- lstat versus stat policy
- symlink reporting and contained target resolution
- root escape and symlink cycle rejection
- safe-integer and timestamp validation
- mode normalization
- unavailable platform fields
- changing-entry races
- missing/permission errors
- accessor/circular/capability boundaries
- bounds and deterministic recovery
- serialization determinism and corruption rejection
- immutability and source preservation
- cross-platform behavior

## Release gate

Releasable only when SPEC, implementation, docs, examples, normal/failure/recovery tests, exact immutable release commit, all supported platform CI gates, and control-plane updates are green.

## Versioning

Initial version: `0.1.0`.
