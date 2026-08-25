# Directory Walker / Bounded Tree Traversal v0.1

## Status

SPEC — implementation must not begin until this document is committed on the control plane.

## Product boundary

Directory Walker is a standalone, dependency-free traversal primitive for walking a directory tree under explicit safety and resource budgets.

It owns:

- deterministic directory traversal
- root anchoring and safe-path integration
- entry classification and inclusion policy
- bounded depth, entry count, path length, and work budgets
- visitor and collected-result modes
- cancellation, timeout, and cooperative backpressure
- filesystem capability seams
- partial traversal and failure/recovery semantics
- non-mutating guarantees

It does not own:

- snapshot/digest serialization
- filesystem watching
- glob/pattern matching
- safe-path policy definition itself
- archive extraction
- shell expansion or shell execution
- persistent storage
- content indexing or search

## API shape

The public API exposes one primary traversal operation and small result/error helpers.

Conceptually:

```js
walk(root, options, capabilities)
```

The implementation may expose synchronous and asynchronous variants only when both share the same locked semantics. The default public path is asynchronous because filesystem access and visitor backpressure are inherently asynchronous.

## Root and path semantics

1. `root` MUST be a non-empty string path.
2. The traversal root is always the explicit scope anchor.
3. Relative child paths MUST be reported relative to the traversal root using `/` as the manifest separator regardless of host OS.
4. Absolute escapes from the root are forbidden.
5. The traversal MUST NOT invoke shell expansion, command execution, tilde expansion, environment expansion, or glob interpretation.
6. The cube MUST consume the released Safe Path Resolver boundary for path containment rather than duplicating containment rules.
7. Drive letters, UNC roots, and Windows namespace roots inherit the Safe Path Resolver's root identity semantics.

## Entry types

Each observed entry is classified as one of:

- `directory`
- `file`
- `symlink`
- `special`
- `unknown`

Policies MUST be explicit for each type. Defaults:

- directories: traverse
- regular files: report
- symlinks: do not follow
- special entries: report only when explicitly enabled
- unknown entries: fail closed unless explicitly configured otherwise

The walker MUST never follow symlinks by default.

## Symlink policy

Supported policies:

- `reject`: report symlink without traversal
- `report`: report symlink metadata without traversal
- `follow-contained`: follow only when the resolved target remains within the traversal root

`follow-contained` MUST:

- use the Safe Path Resolver containment contract
- enforce a configurable maximum symlink depth
- detect repeated canonical targets and reject cycles
- reject root escapes
- fail closed on canonicalization errors

## Deterministic ordering

The walker MUST NOT rely on filesystem enumeration order.

For each directory:

1. read all entries subject to the configured per-directory entry limit
2. normalize each child name for comparison without mutating the actual path
3. sort deterministically using UTF-16 code-unit ordering over the normalized `/`-separated relative path, with raw name as a stable tiebreaker
4. traverse/report entries in that deterministic order

Ordering MUST be identical for the same logical tree across supported hosts.

## Budgets and limits

All budgets are hard limits and are checked before work that would exceed them.

Required limits:

- `maxDepth`
- `maxEntries`
- `maxPathLength`
- `maxNameLength`
- `maxDirectoryEntries`
- `maxSymlinkDepth`
- `maxVisitedDirectories`
- `maxWorkUnits`
- optional `deadlineMs`

A limit may be disabled only by an explicit `null`/documented unlimited value where the contract permits it. Default limits MUST be finite and conservative.

The walker MUST reject invalid limits before touching the filesystem.

## Work accounting

Every directory read, entry classification, canonicalization, and visitor delivery consumes at least one work unit. Implementations may use a larger documented cost for expensive operations.

Once `maxWorkUnits` is exhausted, traversal stops with `WORK_BUDGET_EXCEEDED` and a deterministic partial-result policy.

## Visitor mode

Visitor mode:

```js
await walk(root, { mode: 'visitor', onEntry }, capabilities)
```

Requirements:

- at most one visitor callback is in flight per walker unless explicit parallelism is later added to the contract
- callback completion controls traversal progress
- rejected visitor promises stop traversal with `VISITOR_FAILURE`
- cancellation is checked before invoking each callback
- visitor mode MUST NOT accumulate the entire tree in memory

## Collected mode

Collected mode returns an ordered immutable array of entries.

- every appended entry counts against `maxEntries`
- collection MUST stop before allocating beyond the configured bound
- returned arrays and nested entry records MUST be immutable snapshots

## Cancellation

Cancellation MUST support an `AbortSignal`-compatible capability when provided.

Cancellation checks occur:

- before reading a directory
- after directory enumeration
- before processing each entry
- before invoking the visitor
- after visitor completion

Cancellation MUST produce `ABORTED` and must not mutate the filesystem.

## Timeout/deadline

If `deadlineMs` is provided, traversal MUST fail with `DEADLINE_EXCEEDED` once the deadline is reached.

Timeout checking is cooperative and must occur at the same checkpoints as cancellation.

## Backpressure

Visitor mode is sequential by default. A future parallel mode is out of scope.

The contract therefore guarantees bounded pending work and no unbounded Promise queue.

## Capability seams

Native filesystem operations are injected through a capability object, conceptually:

```js
{
  readDirectory(path),
  lstat(path),
  realpath(path),
  now(),
}
```

Capability hooks are executable seams, not configuration data.

The implementation MUST:

- never recursively validate or clone executable capabilities as plain configuration
- never invoke getters while validating configuration
- reject malformed capability results deterministically
- keep capability names and data contracts bounded

Filesystem mutation capabilities (`mkdir`, `writeFile`, `unlink`, `rename`, etc.) MUST NOT be accepted by the walker API.

## Failure and recovery

Typed failures include at minimum:

- `INVALID_OPTIONS`
- `INVALID_ROOT`
- `PATH_LIMIT_EXCEEDED`
- `DEPTH_LIMIT_EXCEEDED`
- `ENTRY_LIMIT_EXCEEDED`
- `DIRECTORY_ENTRY_LIMIT_EXCEEDED`
- `SYMLINK_DEPTH_EXCEEDED`
- `SYMLINK_CYCLE`
- `ROOT_ESCAPE`
- `SPECIAL_ENTRY_REJECTED`
- `WORK_BUDGET_EXCEEDED`
- `DEADLINE_EXCEEDED`
- `ABORTED`
- `FILESYSTEM_FAILURE`
- `VISITOR_FAILURE`
- `CAPABILITY_FAILURE`

Partial traversal policy is explicit:

- default: fail with a typed error and return no collected result
- optional `partial: 'return'`: return an immutable partial result plus the terminal failure metadata

A failed traversal MUST leave the filesystem unchanged.

## Error normalization

Native filesystem errors may be mapped to stable categories, but raw platform error text MUST remain available only through an optional diagnostic field and MUST NOT affect deterministic equality or ordering.

## Non-mutating guarantee

The walker MUST never create, delete, rename, chmod, chown, or modify filesystem contents.

## Memory safety

Collected mode is bounded by `maxEntries` and entry record bounds.

Visitor mode is bounded by the current call stack/queue and one in-flight callback. Implementations MUST NOT retain processed entries after delivery unless required for cycle detection or configured policies.

## Determinism requirements

For identical logical input tree, options, and normalized capability results:

- traversal order is identical
- relative paths are identical
- entry type values are identical
- error codes are identical
- partial-result ordering is identical

Host locale, timezone, current working directory, environment variables, and filesystem enumeration order MUST NOT affect results.

## Security requirements

The walker MUST fail closed on:

- root escape
- symlink cycle
- exceeded bounds
- malformed capability output
- unknown entry classification where policy is not explicit
- path length overflows
- impossible or inconsistent root identity

The walker MUST NOT expose raw filesystem paths outside the declared root through traversal results when `reportOutsideRoot` is not explicitly supported; that option is out of scope for v0.1.

## Cross-platform verification

Required CI matrix:

- Ubuntu with Node 24
- Windows with Node 24
- macOS-15-Intel with Node 24
- relevant WSL verification where filesystem semantics differ materially

Each release candidate MUST pass:

- syntax check
- full repository tests
- cube-specific contract tests
- failure/recovery tests
- real-browser smoke inherited from repository verification

## Dependency policy

Runtime dependencies: zero third-party packages.

Allowed foundations:

- Node.js standard library
- native filesystem primitives
- the released Safe Path Resolver cube and other Sovereign Library cubes through explicit local imports only

## Release gate

The cube is releasable only when:

1. implementation matches this SPEC
2. public README and examples are complete
3. normal and failure-path tests pass
4. recovery behavior is verified
5. capability seams are contract-tested
6. platform matrix is green
7. release state is reproducible from an immutable commit
8. `PROJECT_CONTROL.md`, `ROADMAP.md`, and `README.md` are updated

## Versioning

Initial version: `0.1.0`.

Breaking changes to these semantics require a new major/minor cube version rather than silent behavior changes.
