# Filesystem Permission / Ownership Descriptor v0.1 — Specification

## Status

SPEC-FROZEN. Implementation may begin only after this file is committed on `main` and the control plane records the SPEC gate as complete.

## Product goal

Provide a standalone, dependency-free descriptor for inspecting filesystem permission and ownership metadata with deterministic normalization across Windows, Linux, macOS, and WSL where supported.

## Non-goals

This cube does not provide a general ACL editor, identity-directory integration, privilege escalation, recursive permission repair, or a guarantee that every filesystem exposes equivalent ownership information.

## Core contract

1. Inspection is non-mutating by default.
2. Permission and ownership data is normalized into an immutable descriptor with explicit capability and availability states.
3. Platform-specific fields are preserved only when they can be represented safely and deterministically.
4. Unsupported or unavailable metadata is represented explicitly; it is never fabricated.
5. User/group identifiers are privacy-sensitive and must not leak through diagnostics unless explicitly requested by a bounded caller contract.
6. Any optional mutation API must be capability-gated, disabled by default, and fail closed when privilege or platform support is insufficient.

## Normalized descriptor

The public descriptor must expose a stable structure containing:

- `path`: caller-approved normalized path identity.
- `platform`: normalized platform family.
- `nodeType`: file, directory, symlink, or other supported node type.
- `mode`: portable permission bits when available, otherwise `null`.
- `readable`, `writable`, `executable`: tri-state values (`true`, `false`, `unknown`) when meaningful.
- `owner`: redacted/bounded ownership descriptor; raw identifiers are opt-in and must never appear in default diagnostics.
- `group`: same privacy rules as owner.
- `acl`: explicit availability state (`available`, `unsupported`, `unavailable`, `not-requested`).
- `flags`: deterministic normalized platform flags when available.
- `capabilities`: immutable capability report describing which fields and optional mutations are supported.
- `observedAt`: injected clock value when supplied by the capability seam.

## Ownership normalization

Owner/group identity must support opaque identifiers without assuming that Windows SIDs, POSIX numeric IDs, names, or platform-specific tokens are interchangeable. The default descriptor must classify identity as `known`, `unknown`, or `redacted` and may expose bounded stable hashes only when the caller explicitly requests them.

## Permission normalization

Portable mode bits must use integer-safe representation. Higher-level booleans must be derived without platform guessing. Windows ACL information is reported through capability states rather than being forced into POSIX mode semantics.

## Capability seams

All filesystem and platform effects must be injectable through callable capabilities, including:

- `lstat` / `stat`
- permission/ACL inspection
- owner/group lookup
- platform identity
- privilege/capability detection
- clock
- deterministic identity/hash implementation

Executable seams must remain separate from plain configuration data. Accessor-backed configuration must be rejected before getter execution.

## Path and containment

The cube may consume a caller-provided already-safe path or a Safe Path Resolver capability. It must not implement an independent `startsWith` containment check. Relative paths are rejected unless an explicit root-resolution capability is supplied.

## Failure semantics

Typed, deterministic failures are required for:

- invalid input
- accessor input
- unsupported capability
- unavailable metadata
- permission denied
- path/root escape
- platform mismatch
- malformed capability result
- bounded-work or metadata-size limit exceeded

Native error messages are not copied into default public diagnostics.

## Mutation boundary

Mutation is out of scope for the base descriptor. A future optional mutation extension must require an explicit capability proof and must expose before/after observations plus recovery status. No mutation is permitted merely because a raw filesystem function is present.

## Determinism and serialization

Serialized descriptors must use canonical JSON ordering, bounded size, immutable parse results, and an integrity digest based on the canonical payload. Equivalent logical descriptors must serialize identically.

## Bounds

The implementation must bound:

- descriptor size
- path length
- owner/group identifier length
- ACL/flag collection size
- collection work units
- recursion depth for any platform-specific metadata traversal

## Cross-platform behavior

- Windows: distinguish DOS/Windows ACL semantics from POSIX mode bits and do not fabricate Unix ownership.
- Linux: support POSIX mode/uid/gid when available and surface ACL capability explicitly.
- macOS: support POSIX metadata and expose ACL availability explicitly.
- WSL: report Linux vs Windows backing capability as observed; do not infer one from the other.
- Other platforms/filesystems: return explicit unsupported/unavailable states.

## Privacy requirements

Default diagnostics must not include raw owner/group names, SIDs, UID/GID values, ACL entries, or environment-derived identity information unless the caller opted in through a bounded explicit option. Error codes and redacted reason fields remain deterministic.

## Recovery/cancellation

Inspection must be side-effect free and cancellation-aware. A cancelled operation may return a typed cancellation result but must not leave persistent state. Any optional mutation extension must define rollback/recovery separately and is not part of v0.1.

## Tests required

The release suite must cover:

- POSIX mode normalization
- tri-state permission derivation
- owner/group redaction
- Windows ACL capability reporting
- unsupported capability behavior
- accessor rejection before getter execution
- malformed capability result rejection
- root/containment boundary
- deterministic serialization and tamper detection
- immutable parse results
- bounded-size rejection
- cancellation and recovery semantics
- Linux, Windows, macOS, and WSL-compatible behavior where the capability exists

## Release gate

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE`

The implementation is complete only when standalone documentation, examples, tests, failure/recovery hardening, supported-platform verification, and zero runtime third-party dependency requirements all pass.
