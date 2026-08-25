# Host Identity / Environment Fingerprint v0.1

## Goal

Provide a standalone, deterministic, privacy-first local host/environment fingerprint that can identify a machine or execution environment for cache partitioning, diagnostics, reproducibility records, compatibility reports, test matrices, and local agent attribution.

The cube must never discover, extract, or infer secrets, credentials, private keys, tokens, cookies, network credentials, or remote host information.

## Public contract

Primary operation:

```js
fingerprintHost(options)
```

Optional comparison helpers:

```js
compareHostFingerprints(left, right)
serializeHostFingerprint(fingerprint)
```

The result is an immutable fingerprint containing explicitly classified fields and a deterministic identity digest.

## Field classes

### Stable identity fields

Stable fields are attributes expected to remain meaningful across ordinary process restarts:

- operating-system family
- operating-system architecture
- kernel or platform release when safely available
- runtime family and major runtime version
- normalized platform path separator semantics
- filesystem case-sensitivity capability when explicitly supplied or safely inferred

Stable fields must never include credentials, user secrets, raw home-directory contents, arbitrary environment values, or unique hardware serials by default.

### Volatile fields

Volatile fields are explicitly separated and never included in the stable identity digest unless the caller opts in:

- current runtime version string beyond the stable major boundary
- current process architecture details
- configured clock timestamp
- bounded non-secret execution hints supplied by the caller

Volatile values must be marked as volatile in the public result.

## Privacy boundary

The default profile must not enumerate all environment variables, inspect credential directories, read SSH material, scan filesystem contents, query password stores, inspect browser profiles, access cloud metadata endpoints, perform network calls, enumerate processes, or read device serial numbers.

Caller-supplied environment fields are opt-in and must pass an explicit allowlist. Each included field is bounded by key and value length.

Sensitive-looking keys must be rejected from the opt-in allowlist even when a caller explicitly supplies them. At minimum reject names containing patterns associated with passwords, secrets, tokens, private keys, credentials, authorization headers, cookies, or API keys.

## Determinism

1. field names use a fixed canonical schema
2. stable fields are normalized to deterministic strings/enums
3. object key ordering is canonical
4. arrays use deterministic ordering rules
5. stable identity digest is derived only from stable fields
6. the system clock is not consulted for stable identity
7. volatile fields are excluded from stable identity unless explicitly requested by a separate comparison mode
8. no random values enter fingerprints implicitly

## Fingerprint identity

The fingerprint exposes:

- `format`: version identifier
- `stable`: immutable stable field object
- `volatile`: immutable volatile field object
- `identity`: `sha256:<64 lowercase hex>` computed from canonical serialization of stable fields
- `serialization`: canonical representation used for identity derivation

The identity is comparison-safe and reproducible for equivalent normalized stable fields.

## Missing capabilities

A field that cannot be obtained must not cause unsafe guessing. The field should either be omitted or represented by a bounded explicit `unavailable` state according to schema rules.

The cube must distinguish:

- unavailable
- unsupported
- permission denied
- invalid capability result

No error should silently become a false stable identity value.

## Capability seams

Injected capabilities may provide:

- platform/runtime identity
- architecture
- kernel/platform release
- path semantics
- filesystem case-sensitivity observation
- selected opt-in non-secret environment fields
- clock for volatile timestamps
- canonical serializer
- hash implementation

Capability objects are execution boundaries and must not be recursively treated as plain caller data or frozen as ordinary configuration.

## Bounds

Enforce hard ceilings for:

- total stable field count
- total volatile field count
- field-name length
- field-value length
- serialized fingerprint bytes
- caller-supplied environment fields
- caller-supplied environment aggregate bytes

Defaults must be conservative enough for agents and automation.

## Validation and failure model

Reject or fail closed on:

- malformed options
- accessor-backed options
- circular plain-data input
- unsupported types
- invalid capability results
- disallowed sensitive field names
- oversized fields
- oversized serialization
- malformed digest results

The cube must recover cleanly after rejected input and must not poison later valid fingerprint calls.

## Comparison semantics

`compareHostFingerprints(left, right)` must distinguish:

- `same_identity` — stable identities match exactly
- `different_identity` — stable identities differ
- `invalid` — one or both fingerprints violate the public contract

Comparison must ignore volatile fields by default.

An explicit caller option may request a verbose field-level difference report, bounded in size and classified as stable/volatile.

## Serialization

Canonical serialization must:

- sort object keys deterministically
- preserve fixed field schema
- reject unsupported non-finite values
- produce stable bytes for semantically equivalent stable fields
- be independent of locale and platform-specific object iteration ordering

## Cross-platform contract

Target verification:

- Ubuntu
- Windows
- macOS-15-Intel
- relevant WSL environments

The output schema remains stable across platforms even when some platform-specific fields are unavailable.

## Standalone boundary

Allowed runtime foundations:

- Node.js standard library
- platform/runtime identity APIs
- explicitly injected caller capabilities

No third-party runtime dependency is required.

This cube does not own:

- runtime capability preflight
- network discovery
- secret management
- credential extraction
- device inventory services
- persistence
- remote host discovery
- process enumeration

## Side-effect boundary

The core is read-only and local. It must not write files, mutate environment variables, make network calls, alter global process state, or persist fingerprints unless a future separate storage adapter consumes the returned value.

## Definition of done

- SPEC committed before implementation
- public API documented
- zero runtime third-party dependencies
- stable/volatile field separation
- privacy-safe defaults and sensitive-name rejection
- deterministic normalization and serialization
- reproducible identity digest
- comparison helper and bounded diff output
- capability seam tests
- malformed/accessor/circular/oversized input tests
- missing capability and permission-denied tests
- cross-platform Linux/Windows/macOS/WSL verification
- README + CHANGELOG
- runnable example
- package registration
- release CI and real-browser smoke gate

Release sequence:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`
