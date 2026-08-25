# Changelog

## Unreleased

### Bounded File Content Reader / Safe Content Access v0.1

- Added the bounded file content reader implementation and deterministic UTF-8/text policies.
- Added bounded binary/text reads, offsets, EOF semantics, chunked streaming, cancellation, deadlines, and work budgets.
- Added Safe Path Resolver anchoring and explicit symlink policies.
- Added capability/data separation, cleanup guarantees, mutation consistency checks, and privacy-safe diagnostics.
- Rebuilt the contract test suite with explicit syntax-safe lifecycle fixtures after CI parser detection.

### Release Verification — Bounded File Content Reader / Safe Content Access v0.1

- PR #94 merged to `main` at `277cb8f4d1e8278fe31c8dc7d3269c5c9bbeee99` after cross-platform pre-merge Verify #693.
- Pre-merge matrix passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, 661/661 tests, and browser smoke.
- Mainline verification is required before the cube is marked FROZEN.

### Host Identity / Environment Fingerprint v0.1

- Added privacy-first local host identity and environment fingerprinting.
- Added stable/volatile field separation and deterministic SHA-256 identity.
- Added explicit capability seams for platform, runtime, path semantics, clock, serialization, hashing, and opt-in environment data.
- Added sensitive environment-name rejection and bounded allowlists.
- Added immutable fingerprints, comparison semantics, canonical serialization, and tamper detection.
- Added cross-platform contract tests and runnable example.
