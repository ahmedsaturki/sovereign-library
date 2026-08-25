# Release Manifest / Integrity Cube v0.1

## Purpose

Provide a standalone deterministic local component for generating versioned canonical manifests, computing native content digests, verifying integrity, and returning immutable mismatch reports.

## Non-goals

No cryptographic signing, key management, remote registries, package publishing, hosted artifact storage, CI-provider SDKs, GUI, or network transport.

## Public contract

### Manifest

```js
{
  version: 1,
  entries: [
    { path, bytes, sha256 }
  ]
}
```

Entries are sorted lexicographically by normalized POSIX path. `bytes` is the exact UTF-8 byte count for the supplied content descriptor. Duplicate paths are rejected.

### Generation

`createManifest(entries, limits?)` validates and canonicalizes descriptors and returns a deeply immutable manifest.

### Verification

`verifyManifest(manifest, entries, limits?)` recomputes descriptors and returns an immutable report containing `ok`, sorted `missing`, sorted `extra`, and sorted `mismatched` entries.

### Integrity

SHA-256 is computed with Node's built-in `node:crypto` primitives. No runtime third-party dependency is permitted.

## Safety and bounds

Reject accessor-bearing objects before evaluating getters; reject unsafe paths, absolute paths, `..` traversal, duplicate paths, unsupported values, malformed manifests, and oversized entry/path/manifest inputs. Diagnostics must not copy arbitrary payloads.

## Cross-platform requirements

Use POSIX path semantics in the manifest itself; do not depend on host path separators. Verification must produce identical results for the same logical entry set on Windows, Linux, and macOS.

## Definition of done

SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE with syntax, full repository tests, browser smoke, immutable outputs, deterministic ordering, corruption/mismatch coverage, and zero runtime third-party dependencies.
