# Safe Path Resolver / Containment Boundary v0.1 — SPEC

## 1. Product identity

**Name:** Safe Path Resolver / Containment Boundary
**Version:** v0.1
**Format:** SPR1
**Primary goal:** provide a standalone, deterministic path-resolution and containment boundary for applications that must answer “what path does this input denote under this root, and is it contained?” without filesystem side effects in the lexical core.

The cube is independent of directory walking, glob matching, file watching, archive extraction, shell execution, and persistence.

## 2. Product boundary

The cube has two modes:

1. **Lexical mode** — pure normalization, resolution, comparison, and containment. No filesystem access.
2. **Filesystem-aware mode** — optional canonicalization through injected capabilities, followed by the same structural containment rules.

The mode must never change implicitly because of the host operating system.

## 3. Public API

The implementation provides:

- `normalizePath(input, options)` — deterministic lexical normalization.
- `resolvePath(base, input, options)` — resolves a relative input against an explicit absolute base.
- `isContained(path, root, options)` — returns an immutable structural containment report.
- `resolveContained(root, input, options)` — resolves and returns the result only when it is contained.
- `canonicalizePath(input, root, capabilities, options)` — filesystem-aware canonicalization using narrow injected capabilities.
- `comparePaths(left, right, options)` — explicit host-independent ordering/equality semantics.
- `serializeReport(report)` / `parseReport(serialized)` — deterministic SPR1 serialization with integrity verification.

## 4. Path model

Supported classes:

- POSIX absolute: `/a/b`
- POSIX relative: `a/b`
- Windows drive-qualified: `C:/a/b`
- UNC: `//server/share/a/b`
- Windows namespace drive: `//?/C:/a/b`
- Windows namespace UNC: `//?/UNC/server/share/a/b`

Drive-relative values such as `C:foo` are rejected because their meaning depends on process state.

Relative resolution never consults `process.cwd()`; callers must supply an explicit absolute base.

Roots are structural identities, not string prefixes. Different drives, UNC shares, and namespace roots cannot compare as contained.

## 5. Lexical normalization

Default `separatorNormalization=true` converts backslashes to `/` while preserving explicit UNC/namespace prefixes.

- `.` segments are removed when `normalizeDotSegments=true`.
- `..` removes one prior normal segment when legal.
- absolute roots cannot traverse above their root.
- relative inputs used for safe resolution cannot escape their caller-defined base.
- empty input and NUL-containing input are rejected.
- input and normalized segment counts are bounded.

## 6. Containment semantics

Containment is segment-aware and never string-prefix based.

Example:

- `/root/app` contains `/root/app/file.txt`.
- `/root/app` does not contain `/root/application`.

Containment results are immutable and expose:

- `contained`
- `outside`

A different root identity reports `reason: root-mismatch`.

Security-sensitive filesystem-aware operations fail closed when required capabilities are missing or when canonical targets escape the root.

## 7. Root anchoring and case policy

Every containment-safe operation requires an explicit root/base.

Root comparison is structural:

- `C:/x` and `D:/x` are different.
- `//server/share/x` and `//server/other/x` are different.
- `//?/C:/x` has a distinct namespace identity from `C:/x` unless an explicit normalization policy is added later.

Default `caseMode` is `sensitive`.

`caseMode: insensitive` uses fixed `en-US` lowercasing and never consults host locale defaults.

## 8. Symlink policies

Filesystem-aware operations support:

- `lexical-only` — no symlink observation.
- `reject-symlink` — canonicalization is allowed, but a symlink destination is rejected when `lstat` reports one.
- `follow-contained` — canonicalization follows symlinks but remains fail-closed on containment escape and resolution-depth overflow.

`follow-contained` requires an explicit `symlinkDepth(path)` capability. The root and target hop counts are summed and must not exceed `maxSymlinkDepth` (default 64, maximum 64).

This makes the depth boundary explicit and testable instead of assuming that a single `realpath()` call proves a safe resolution depth.

## 9. Capability seams

Filesystem-aware resolution may use only narrow executable capabilities:

- `realpath(path)` — returns a canonical path string.
- `lstat(path)` — returns bounded metadata used by reject-symlink policy.
- `symlinkDepth(path)` — returns a non-negative integer hop count used by follow-contained policy.

Capability containers are execution seams, not plain configuration data. Validation must never freeze, recursively traverse, serialize, or invoke capability functions.

Capability results are validated before they affect decisions.

## 10. Determinism

The core does not depend on host defaults for:

- current working directory
- case policy
- separator policy
- root comparison
- locale ordering

All results are immutable and input objects are not mutated.

## 11. Bounds

Initial hard limits:

- maximum path length: 32 KiB
- maximum segments: 1024
- maximum symlink depth: 64
- maximum serialized report size: 256 KiB
- validation depth: 16

Bounds are enforced before capability expansion and rejected calls do not poison later valid calls.

## 12. Failure and recovery

Typed failures include:

- `INVALID_PATH`
- `MISSING_BASE`
- `TRAVERSAL_ESCAPE`
- `ROOT_MISMATCH`
- `SYMLINK_REJECTED`
- `SYMLINK_ESCAPE`
- `SYMLINK_DEPTH_EXCEEDED`
- `CAPABILITY_UNAVAILABLE`
- `CAPABILITY_RESULT_INVALID`
- `LIMIT_EXCEEDED`
- `ACCESSOR_INPUT`
- `CIRCULAR_INPUT`
- `INTEGRITY_FAILURE`
- `MALFORMED_SERIALIZATION`

A rejected or malformed call must not poison later independent valid calls.

## 13. Mutation contract

All public operations are non-mutating with respect to caller input.

The cube must not:

- create, delete, or write filesystem objects
- alter permissions
- change process cwd
- mutate environment variables
- invoke shell commands

Filesystem-aware behavior exists only behind injected capabilities.

## 14. SPR1 serialization and integrity

`serializeReport()` creates a versioned envelope:

```json
{
  "format": "SPR1",
  "version": 1,
  "payload": "<canonical-json>",
  "integrity": "<64 lowercase hex chars>"
}
```

The payload is canonical JSON with recursively sorted object keys.

The integrity field is:

`SHA-256("SPR1|1|" + payload)`

`parseReport()` must reject:

- malformed JSON
- incorrect format/version
- missing or malformed integrity
- tampered payloads
- oversized serialized data

Integrity failures use `INTEGRITY_FAILURE` and verification uses constant-time byte comparison.

Parsed payloads are deeply validated and returned immutable.

## 15. Cross-platform contract

Verification matrix:

- Ubuntu Linux
- Windows
- macOS-15-Intel
- relevant WSL coverage where filesystem-aware behavior is exercised

Tests cover POSIX, drive, UNC, namespace roots, separators, traversal, sibling-prefix escapes, explicit case rules, canonical containment escape, symlink rejection, bounded symlink depth, serialization tampering, and recovery after rejected input.

## 16. Dependency boundary

Runtime third-party dependencies: **zero**.

Allowed foundations:

- Node.js standard library
- native filesystem/path behavior supplied through injected capabilities

No external path library or shell utility is required.

## 17. Definition of done

The cube is complete only when:

- implementation matches this SPEC
- public README/API documentation exists
- examples cover lexical and filesystem-aware paths
- normal, malformed, boundary, recovery, namespace, containment, symlink, integrity, and cross-platform tests pass
- full repository syntax/tests pass
- browser smoke and platform CI gates pass
- pre-merge and post-merge verification pass on the release commit
- `PROJECT_CONTROL.md` and `ROADMAP.md` record the final release and freeze

## 18. Release gate

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

No unrelated cube implementation may enter while this milestone is active.
