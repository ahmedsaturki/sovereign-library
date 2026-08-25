# Safe Path Resolver / Containment Boundary v0.1 — SPEC

## 1. Product identity

**Name:** Safe Path Resolver / Containment Boundary
**Version:** v0.1
**Format:** SPR1
**Primary goal:** provide a small, standalone, deterministic path-resolution and containment boundary that callers can use to answer: “What path does this input denote under this root, and is it safely contained?”

The cube is independent of directory walking, glob matching, file watching, archive extraction, shell execution, and persistence.

## 2. Product boundary

The cube exposes two related modes:

1. **Lexical mode:** resolves path syntax only. It does not touch the filesystem and cannot observe symlinks.
2. **Filesystem-aware mode:** optionally canonicalizes existing path components through injected filesystem capabilities, then applies the same containment rules.

No API may silently switch modes because of the host operating system.

## 3. Core operations

The public API must provide:

- `normalizePath(input, options)` — deterministic lexical normalization.
- `resolvePath(base, input, options)` — resolves a relative input against an explicit base.
- `isContained(path, root, options)` — returns immutable deterministic containment result.
- `resolveContained(root, input, options)` — resolves and returns a path only when it is safely contained.
- `canonicalizePath(input, capabilities, options)` — filesystem-aware canonicalization using narrow injected capabilities.
- `comparePaths(left, right, options)` — explicit, host-independent equality/ordering semantics.
- deterministic SPR1 serialization/parsing for resolver outputs and containment reports.

## 4. Path model

Supported path classes:

- POSIX absolute paths: `/a/b`.
- POSIX relative paths: `a/b`.
- Windows drive-qualified paths: `C:/a/b`.
- Windows drive-relative paths are rejected by default because `C:foo` depends on process state.
- UNC paths: `//server/share/a/b`.
- Windows namespace paths such as `//?/C:/a` and `//?/UNC/server/share/a` are normalized to an explicit namespace representation and never silently converted to another volume.

The implementation must not inspect `process.cwd()` to resolve ambiguity. Callers must provide an explicit base for relative inputs.

## 5. Lexical normalization

Default separator normalization converts `\\` to `/` only when `separatorNormalization=true`.

The following semantics are required:

- `.` segments are removed only when `normalizeDotSegments=true`.
- `..` removes one prior normal segment when allowed.
- an absolute path may never walk above its root.
- a relative path may not escape its supplied base scope when containment-safe resolution is requested.
- repeated separators are rejected when separator normalization is enabled and the repeated separator is not part of an explicit UNC or namespace prefix.
- empty input is rejected.
- control characters and NUL are rejected.

## 6. Containment semantics

Containment is segment-aware, never string-prefix based.

`/root/app` contains `/root/app/file.txt` but does not contain `/root/application`.

A result must expose one of:

- `contained`
- `outside`
- `invalid`
- `indeterminate` (filesystem-aware mode only when a requested canonicalization capability is unavailable and policy allows non-fatal uncertainty)

The default security policy is fail-closed: missing capability, ambiguity, or unresolved symlink behavior yields `invalid` or `indeterminate`, never `contained` by assumption.

## 7. Root anchoring

Every containment-safe operation requires an explicit root/base.

A path with a different drive, volume, UNC share, or namespace root cannot be contained by a root from another identity.

Comparison of Windows roots is structural:

- `C:/x` and `D:/x` are different roots.
- `//server/share/x` and `//server/other/x` are different roots.
- `//?/C:/x` and `C:/x` may compare equal only after an explicit normalization policy declares them the same identity.

No locale-sensitive string comparison may decide root identity.

## 8. Symlink policies

Filesystem-aware operations expose an explicit policy:

- `lexical-only` — do not resolve symlinks.
- `follow-contained` — resolve symlinks and reject targets that escape the root.
- `reject-symlink` — fail closed when a path component is a symlink.

The default is `lexical-only` for pure APIs and `reject-symlink` for security-sensitive filesystem-aware containment.

Symlink resolution must include cycle detection and a bounded maximum resolution depth.

## 9. Capability seams

Filesystem-aware resolution receives a capability object containing only narrow executable seams, for example:

- `lstat(path)`
- `realpath(path)`
- `readlink(path)`

Capability objects are execution hooks, not plain configuration data. The validation boundary must never recursively traverse, freeze, serialize, or invoke a capability function while validating caller data.

Capability results are validated as bounded plain data before use.

## 10. Determinism

The core must not depend on host OS defaults for:

- case sensitivity
- separator policy
- root comparison
- Unicode normalization
- locale ordering

Default case mode is `sensitive`.

Case-insensitive comparison, when explicitly requested, must use a fixed locale-independent mapping.

## 11. Bounds

Suggested initial hard limits:

- maximum input path: 32 KiB
- maximum normalized path: 32 KiB
- maximum segments: 1024
- maximum symlink resolution depth: 64
- maximum serialized report size: 256 KiB
- maximum diagnostic message size: 4 KiB

Exceeding a bound must produce a typed limit error before filesystem mutation or capability expansion.

## 12. Failure and recovery

Typed error codes must distinguish:

- `INVALID_PATH`
- `MISSING_BASE`
- `TRAVERSAL_ESCAPE`
- `ROOT_MISMATCH`
- `VOLUME_MISMATCH`
- `SYMLINK_REJECTED`
- `SYMLINK_ESCAPE`
- `SYMLINK_CYCLE`
- `CAPABILITY_UNAVAILABLE`
- `CAPABILITY_RESULT_INVALID`
- `LIMIT_EXCEEDED`
- `ACCESSOR_INPUT`
- `CIRCULAR_INPUT`
- `INTEGRITY_MISMATCH`
- `MALFORMED_SERIALIZATION`

A rejected call must not poison later independent valid calls.

## 13. Mutation contract

All public operations are non-mutating with respect to caller-provided inputs.

The cube may allocate internal immutable result objects, but it must not:

- create directories
- write files
- alter permissions
- change process cwd
- mutate environment variables
- invoke shell commands

## 14. Serialization

SPR1 serialization must:

- use deterministic canonical field ordering
- include format and schema version
- include an integrity checksum
- reject malformed, unknown-version, oversized, or tampered payloads
- round-trip without changing semantic identity
- return deeply immutable parsed results

## 15. Cross-platform contract

The verification matrix must include:

- Ubuntu Linux
- Windows
- macOS-15-Intel
- relevant WSL environment when filesystem-aware behavior is exercised

Tests must cover POSIX roots, Windows drives, UNC paths, namespace paths, separator normalization, root/volume mismatch, symlink behavior, and recovery after rejected inputs.

## 16. Dependency boundary

Runtime third-party dependencies: **zero**.

Allowed foundations:

- Node.js standard library
- native filesystem/path primitives through injected capabilities

No shell-based path utilities and no external path libraries may be required at runtime.

## 17. Definition of done

The cube is complete only when:

- implementation matches this SPEC
- public README/API documentation exists
- examples exercise lexical and filesystem-aware modes
- normal, malformed, boundary, recovery, symlink, namespace, and cross-volume tests pass
- full repository syntax/tests pass
- browser smoke and platform CI pass where required by repository gates
- release commit is reproducible
- `PROJECT_CONTROL.md` and `ROADMAP.md` record the final release and freeze
- a post-merge verification run passes on the release commit

## 18. Release gate

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

No implementation from a different cube may enter this milestone while it is active.
