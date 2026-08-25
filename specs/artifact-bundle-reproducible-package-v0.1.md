# Artifact Bundle / Reproducible Package v0.1

## Goal

Provide a standalone deterministic local bundle/package component that can reproduce the same bytes from the same bounded logical inputs, verify integrity without arbitrary command execution, and safely extract into a caller-selected directory.

## Public contract

### Bundle definition

- versioned format identifier
- ordered file entries with normalized POSIX-style relative paths
- per-entry byte length and SHA-256 digest
- bounded metadata object
- deterministic canonical serialization

### Generation

- input paths are normalized and validated before reading
- entry ordering is independent of source enumeration order
- duplicate logical paths fail closed
- timestamps and host-specific metadata are excluded from reproducible output unless explicitly represented by the format
- total bundle size and entry counts are bounded

### Verification

- parse and validate the versioned format before exposing entry content
- recompute digests from stored bytes
- report missing, extra, size, and digest mismatches deterministically
- malformed, truncated, corrupt, and unsupported bundles fail closed

### Extraction

- normalize and validate every target path before writing
- reject absolute paths, drive-qualified paths, traversal segments, and duplicate output paths
- never execute embedded commands or scripts
- preserve entry bytes exactly
- fail safely on bounds violations

## Safety limits

- maximum entry count
- maximum path byte length
- maximum per-entry size
- maximum metadata size
- maximum total bundle size
- bounded verification diagnostics

## Determinism requirements

For identical logical inputs and configuration, output bytes, entry order, digests, serialized metadata, and verification reports must be identical across supported platforms.

## Dependencies

Zero runtime third-party dependencies. Native Node.js standard-library primitives only.

## Out of scope

- remote registries
- package publishing
- signing/key management
- remote replication
- GUI/admin console
- network transport
- installer generation
- operating-system package formats

## Definition of done

The cube is DONE only after:

1. SPEC committed
2. implementation complete
3. unit/contract/failure/recovery tests complete
4. cross-platform GitHub Actions pass on Ubuntu, Windows, and macOS-15-Intel
5. real-browser smoke gate passes
6. README and runnable example are present
7. release merge is followed by a clean `main` post-merge verification
8. PROJECT_CONTROL.md, ROADMAP.md, and README.md record the release and freeze
