# Sovereign Library — Public API Boundary v0.1

## Purpose

Freeze the first public-package candidate surface before package tooling. Only symbols listed here are public candidates for the first package batch. All other module-local symbols are internal unless a later versioned contract explicitly promotes them.

## Candidate packages

### 1. Safe Path Resolver / Containment Boundary
Public candidates verified from `cubes/safe-path-resolver-containment-boundary/src/index.js`:
- `SafePathResolverError`
- `normalizePath`
- `resolvePath`
- `isContained`
- `resolveContained`
- `canonicalizePath`
- `comparePaths`
- `serializeReport`
- `parseReport`

Format/limits constants are contract candidates only after declaration/export review; do not treat module constants as public automatically.

### 2. Glob / Path Matcher
Verified exports:
- `GlobPathMatcherError`
- `compileGlob`
- `normalizeCandidatePath`
- `matchGlob`
- `evaluateRules`
- `serializePattern`
- `parsePattern`
- `GLOB_PATH_MATCHER_FORMAT`
- `GLOB_PATH_MATCHER_LIMITS`

### 3. Filesystem Watcher / Change Stream
Verified exports:
- `FilesystemWatcherError`
- `createWatcher`
- `FILESYSTEM_WATCHER_FORMAT`
- `FILESYSTEM_WATCHER_STATES`
- `FILESYSTEM_WATCHER_EVENT_TYPES`

`createWatcher()` returns the public capability surface `{ start, next, close, stats }`.

### 4. File Lease / Advisory Lock
Verified exports:
- `FileLeaseError`
- `acquireLease`
- `serializeLeaseRecord`
- `parseLeaseRecord`
- `FILE_LEASE_FORMAT`
- `FILE_LEASE_STATES`

`acquireLease()` returns the public lease surface plus `renew` and `release` methods; internal filesystem/capability helpers remain private.

### 5. Atomic File Writer / Safe Replace
Verified exports:
- `AtomicFileWriterError`
- `writeFileAtomic`
- `ATOMIC_FILE_WRITER_FORMAT`
- `ATOMIC_FILE_WRITER_DURABILITY`

### 6. Ephemeral Workspace / Scratch Directory
Verified exports:
- `WorkspaceError`
- `createWorkspace`
- `recoverWorkspace`
- `serializeWorkspaceRecord`
- `parseWorkspaceRecord`
- `EPHEMERAL_WORKSPACE_FORMAT`
- `EPHEMERAL_WORKSPACE_STATES`

`createWorkspace()` public instance methods are `path`, `cleanup`, and `isExpired`.

### 7. Directory Snapshot / Tree Manifest
Verified exports from the current implementation surface:
- `DirectorySnapshotError`
- `snapshotDirectory`
- `serializeDirectorySnapshot`

Any additional declaration or constant exports remain internal until explicitly verified and added to this manifest.

### 8. Runtime Capability Inspector
Verified exports:
- `RuntimeCapabilityError`
- `inspectRuntime`
- `evaluateRuntimeRequirements`
- `serializeRuntimeReport`
- `parseRuntimeReport`
- `RUNTIME_CAPABILITY_FORMAT`
- `RUNTIME_OS_FAMILIES`
- `RUNTIME_ARCHITECTURES`

## Public contract rules

1. Named exports listed above are the only first-batch API candidates.
2. Default exports are not part of the first-batch contract.
3. Internal helpers, capability seams, timers, native filesystem handles, and implementation state are never public API.
4. Return values must remain bounded and immutable where the current cube contract promises immutability.
5. Error classes/codes are public only where explicitly listed above; adding a new stable code requires a versioned contract change.
6. Serialization formats are public only where the format constant and serializer/parser are listed together.
7. Capability injection remains an extension seam, not a package-level dependency.
8. No package may publish until this boundary has passed CI, API/declaration review, security review, and reproducible-pack verification.

## Compatibility policy

- v0.1 permits additive internal fixes but no silent breaking removal of a listed symbol.
- Changing a listed function signature, error-code contract, serialized format, return-shape invariant, or bound requires a new versioned API-boundary decision.
- First public packages remain independently versioned.

## Non-goals

- No npm publication.
- No package.json generation.
- No TypeScript rewrite.
- No automated API extractor baseline yet.

## Gate

`Inventory -> License -> API Boundary Freeze -> Declaration Strategy -> Package Tooling -> Reproducible Pack -> Security -> Publish`
