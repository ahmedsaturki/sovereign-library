# Sovereign Library — Public API Boundary v0.1

## Purpose

Freeze the first public-package candidate surface before package tooling. Only symbols listed here are public candidates for the first package batch. All other module-local symbols are internal unless a later versioned contract explicitly promotes them.

## Candidate packages

### 1. Safe Path Resolver / Containment Boundary
- `SafePathResolverError`
- `normalizePath`
- `resolvePath`
- `isContained`
- `resolveContained`
- `canonicalizePath`
- `comparePaths`
- `serializeReport`
- `parseReport`
- `SAFE_PATH_RESOLVER_FORMAT`
- `SAFE_PATH_RESOLVER_LIMITS`

### 2. Glob / Path Matcher
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
- `FilesystemWatcherError`
- `createWatcher`
- `FILESYSTEM_WATCHER_FORMAT`
- `FILESYSTEM_WATCHER_STATES`
- `FILESYSTEM_WATCHER_EVENT_TYPES`

`createWatcher()` returns the public capability surface `{ start, next, close, stats }`.

### 4. File Lease / Advisory Lock
- `FileLeaseError`
- `acquireLease`
- `serializeLeaseRecord`
- `parseLeaseRecord`
- `FILE_LEASE_FORMAT`
- `FILE_LEASE_STATES`

`acquireLease()` returns a public lease object with `renew` and `release` methods.

### 5. Atomic File Writer / Safe Replace
- `AtomicFileWriterError`
- `writeFileAtomic`
- `ATOMIC_FILE_WRITER_FORMAT`
- `ATOMIC_FILE_WRITER_DURABILITY`

### 6. Ephemeral Workspace / Scratch Directory
- `WorkspaceError`
- `createWorkspace`
- `recoverWorkspace`
- `serializeWorkspaceRecord`
- `parseWorkspaceRecord`
- `EPHEMERAL_WORKSPACE_FORMAT`
- `EPHEMERAL_WORKSPACE_STATES`

`createWorkspace()` returns the public instance methods `path`, `cleanup`, and `isExpired`.

### 7. Directory Snapshot / Tree Manifest
Verified candidates:
- `DirectorySnapshotError`
- `snapshotDirectory`
- `serializeDirectorySnapshot`

No additional symbol is promoted to public API until explicitly verified and added here.

### 8. Runtime Capability Inspector
- `RuntimeCapabilityError`
- `inspectRuntime`
- `evaluateRuntimeRequirements`
- `serializeRuntimeReport`
- `parseRuntimeReport`
- `RUNTIME_CAPABILITY_FORMAT`
- `RUNTIME_OS_FAMILIES`
- `RUNTIME_ARCHITECTURES`

## Public contract rules

1. Only the symbols listed above are first-batch public API candidates.
2. Default exports are not part of the first-batch contract.
3. Internal helpers, capability seams, timers, native handles, and implementation state are never public API.
4. Bounded and immutable return-shape promises remain part of the relevant Cube contract.
5. Error classes/codes are public only where explicitly listed.
6. Serialization formats are public only when serializer/parser and format are listed together.
7. Capability injection is an extension seam, not a runtime dependency.
8. No package may publish until API/declaration, security, reproducibility, and CI gates pass.

## Compatibility policy

- v0.1 allows internal fixes without changing listed public symbols.
- Changing a listed function signature, error-code contract, serialized format, return-shape invariant, or bound requires a new versioned API-boundary decision.
- First public packages remain independently versioned.

## Non-goals

- No npm publication.
- No package.json generation.
- No TypeScript rewrite.
- No API Extractor baseline yet.

## Gate

`Inventory -> License -> API Boundary Freeze -> Declaration Strategy -> Package Tooling -> Reproducible Pack -> Security -> Publish`
