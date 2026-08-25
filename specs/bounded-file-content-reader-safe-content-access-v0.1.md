# Bounded File Content Reader / Safe Content Access v0.1

## Status

SPEC — implementation must not begin until this document is committed on the control plane.

## Product boundary

Bounded File Content Reader is a standalone dependency-free primitive for reading file bytes or UTF-8 text under explicit path, size, offset, time, work, memory, cancellation, and decoding policies.

It owns:

- safe bounded binary and UTF-8 text reads
- explicit offset/length semantics
- streaming/chunked/collected modes
- memory and work budgets
- EOF and partial-read rules
- BOM/newline/decoder policy
- symlink policy
- Safe Path Resolver integration
- cancellation, deadlines, backpressure, and cleanup
- changing-file/truncation race semantics
- immutable deterministic results
- bounded privacy-safe diagnostics

It does not own:

- directory traversal
- metadata/stat normalization
- filesystem watching
- glob/pattern matching
- snapshots/manifests
- persistence
- archive extraction
- shell execution
- search/indexing

## API shape

Conceptually:

```js
readFileContent(path, options, capabilities)
readFileStream(path, options, capabilities)
```

The implementation MUST expose one canonical async core. A collected convenience wrapper may consume the same core while preserving the locked limits.

## Binary versus text

The caller MUST choose one mode explicitly:

- `binary` — returns bytes (`Uint8Array` or equivalent immutable byte representation)
- `text` — decodes UTF-8 only in v0.1

There is no automatic encoding detection.

Encoding names other than UTF-8 are out of scope for v0.1.

## Path safety

1. `path` MUST be a bounded non-empty string without NUL bytes.
2. The reader MUST consume the released Safe Path Resolver boundary for root anchoring/containment when a root is supplied.
3. Shell expansion, environment expansion, glob expansion, tilde expansion, and command execution are forbidden.
4. `root` is optional only when the caller explicitly permits an unanchored absolute path.
5. Relative paths require an explicit absolute base/root.

## Symlink policy

Default: `reject`.

Supported policies:

- `reject` — fail with `SYMLINK_REJECTED`
- `report` — return a bounded symlink metadata result without reading target content
- `follow-contained` — resolve only when Safe Path Resolver containment confirms the target is inside the declared root

Symlink depth and cycle protection MUST be bounded.

## Read geometry

Options MUST support:

- `offset` — non-negative byte offset, default `0`
- `length` — optional non-negative maximum byte count
- `chunkSize` — streaming chunk size

Rules:

- `offset` beyond EOF returns an empty result, not an error
- `length: 0` returns an empty result without opening the file when the implementation can prove the operation is side-effect free
- `offset + length` MUST be checked for safe integer overflow
- all byte counts MUST remain safe integers

## Modes

### Collected

Returns a bounded immutable result containing:

- path/display identity
- actual bytes read
- requested offset/length
- actual byte count
- EOF status
- consistency status

The maximum collected bytes are hard-bounded by `maxBytes`.

### Chunked

Returns ordered immutable chunks through an async iterator or equivalent callback protocol.

Requirements:

- chunks are yielded in file order
- no unbounded chunk queue
- at most one unresolved chunk promise is pending by default
- consumer backpressure controls subsequent reads

### Streaming visitor

Optional callback mode may deliver bounded chunks sequentially. Callback rejection stops the read and closes the owned handle.

## Budgets

Hard limits:

- `maxBytes`
- `maxChunkSize`
- `maxPathLength`
- `maxWorkUnits`
- `deadlineMs`
- `maxDiagnosticBytes`
- `maxChunks` where streaming mode needs an explicit count bound

Default limits MUST be finite and conservative.

The reader MUST reject invalid limits before opening the file.

## Work accounting

At minimum, opening, each read operation, each decoder step, each chunk delivery, and each metadata validation consume work units.

Once the budget is exhausted, the reader MUST stop with `WORK_BUDGET_EXCEEDED`.

## Binary semantics

Binary mode returns exact bytes without transcoding.

The input file is never implicitly converted to text.

Byte ordering is file-native and no endian interpretation is performed.

## UTF-8 text semantics

Text mode MUST use strict UTF-8 decoding by default.

Invalid UTF-8 sequences produce `DECODE_ERROR` and MUST NOT be silently replaced.

Options:

- `bom: 'strip' | 'preserve' | 'reject'`, default `strip`
- `newline: 'preserve' | 'lf'`, default `preserve`

`newline: 'lf'` normalizes `CRLF` and `CR` to `LF` after decoding.

BOM handling occurs before newline normalization.

## EOF semantics

Reading terminates successfully at EOF when the requested range exceeds the actual file length, with `eof: true` and `actualBytes < requestedBytes`.

EOF is not an error.

## File-change semantics

The reader MUST explicitly choose one policy:

- `strict` — detect material size/identity changes when the capability permits and fail with `CHANGED_DURING_READ`
- `best-effort` — return bytes actually read and mark `consistency: 'best-effort'`

Default is `strict` where safe pre/post metadata checks are available; otherwise the implementation MUST report `best-effort` rather than claim strict consistency.

Truncation during reading MUST never cause an out-of-bounds memory allocation.

## Capability seams

Executable hooks are injected separately from data options:

```js
{
  open(path, flags),
  read(handle, buffer, offset, length, position),
  close(handle),
  lstat(path),
  stat(path),
  realpath(path),
  now()
}
```

Capabilities MUST:

- reject accessors before getter execution
- reject non-function hooks
- never be recursively validated as plain data
- normalize malformed results into typed capability failures
- guarantee cleanup for handles opened by the reader

Filesystem mutation capabilities MUST NOT be accepted.

## Cancellation and deadline

An AbortSignal-compatible capability is supported.

Checks MUST happen:

- before open
- before each read
- before each chunk delivery
- before decoding a new chunk
- before finalization

Cancellation returns `ABORTED` and MUST close the owned handle.

Deadline expiry returns `DEADLINE_EXCEEDED` and MUST close the owned handle.

## Cleanup

The reader owns every file handle it opens.

On success, failure, cancellation, timeout, decode failure, visitor failure, or capability failure, owned handles MUST be closed exactly once.

Cleanup errors MUST never hide the primary error; they may appear in a bounded secondary diagnostic field.

## Errors

At minimum:

- `INVALID_OPTIONS`
- `INVALID_PATH`
- `PATH_LIMIT_EXCEEDED`
- `SYMLINK_REJECTED`
- `ROOT_ESCAPE`
- `SYMLINK_CYCLE`
- `OFFSET_LIMIT_EXCEEDED`
- `LENGTH_LIMIT_EXCEEDED`
- `WORK_BUDGET_EXCEEDED`
- `DEADLINE_EXCEEDED`
- `ABORTED`
- `NOT_FOUND`
- `PERMISSION_DENIED`
- `READ_FAILURE`
- `CLOSE_FAILURE`
- `DECODE_ERROR`
- `CHANGED_DURING_READ`
- `CAPABILITY_FAILURE`
- `VISITOR_FAILURE`
- `LIMIT_EXCEEDED`

Native error messages MUST be bounded and MUST NOT copy file contents into diagnostics.

## Privacy and diagnostics

Diagnostics MUST NOT include arbitrary content bytes, decoded file contents, environment values, usernames, hostnames, or unrelated filesystem paths.

Only the caller-supplied path identity and bounded native error code/message are allowed.

## Immutability

Collected results, metadata, error snapshots, and chunk descriptors MUST be immutable.

Input options and capability objects MUST never be mutated.

## Cross-platform verification

Required:

- Ubuntu + Node 24
- Windows + Node 24
- macOS-15-Intel + Node 24
- relevant WSL verification for path/handle semantics

Release candidates MUST pass syntax, full repository tests, cube-specific contract tests, recovery/cleanup tests, and repository browser smoke.

## Dependency policy

Runtime dependencies: zero third-party packages.

Allowed foundations:

- Node.js standard library
- native filesystem primitives
- released Safe Path Resolver and Metadata Normalizer cubes through explicit local imports

## Test requirements

Before release, tests MUST cover:

- binary exact bytes
- UTF-8 valid and invalid input
- BOM policies
- newline policies
- offset/length/EOF behavior
- max bytes/chunks/chunk-size/work/deadline
- visitor/stream backpressure
- cancellation/timeout cleanup
- symlink policies and root escape
- changed/truncated files
- permission/not-found recovery
- accessor/circular capability boundaries
- deterministic immutable results
- privacy-safe diagnostics
- cross-platform path/handle behavior

## Release gate

Releasable only when SPEC, implementation, docs, examples, tests, failure/recovery semantics, exact immutable release commit, three-platform CI, post-merge verification, and control-plane updates are green.

## Versioning

Initial version: `0.1.0`.
