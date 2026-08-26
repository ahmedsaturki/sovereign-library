# Changelog

## Unreleased

### Atomic Batch File Transaction / Safe Multi-File Commit v0.1

- Added deterministic bounded batch planning for create, replace, and delete operations.
- Added root containment, duplicate-destination rejection, preflight checks, staging, rollback attempts, and explicit recovery-required states.
- Added capability seams for filesystem mutation, identity, clock, and test failure injection.
- Added ABT1 SHA-256 integrity-protected immutable receipts with bounded parsing.
- Added privacy-safe bounded diagnostics and explicit guarantee/durability levels.
- Hardened absolute-root enforcement, proof-gated `strong-local` atomicity, and truthful post-cleanup rollback availability reporting.

### File Lease / Advisory Lock v0.1 — corrective hardening

- Hardened stale-recovery ownership so an old lease cannot renew after a successor acquires the lock.
- Hardened orphan-lock recovery to fail closed when no valid owner record exists.
- Hardened release so an unexpected lock-directory entry cannot produce a false successful release.
- Added cross-platform regression coverage and package test-gate integration.

### Bounded File Content Reader / Safe Content Access v0.1

- Added the bounded file content reader implementation and deterministic UTF-8/text policies.
- Added bounded binary/text reads, offsets, EOF semantics, chunked streaming, cancellation, deadlines, and work budgets.
- Added Safe Path Resolver anchoring and explicit symlink policies.
- Added capability/data separation, cleanup guarantees, mutation consistency checks, and privacy-safe diagnostics.

### Release Verification — Bounded File Content Reader / Safe Content Access v0.1

- PR #94 merged to `main` at `277cb8f4d1e8278fe31c8dc7d3269c5c9bbeee99` after cross-platform pre-merge Verify #693.
- Pre-merge matrix passed on Ubuntu, Windows, and macOS-15-Intel with syntax checks, 661/661 tests, and browser smoke.
- Mainline verification required a fresh macOS runner after a transient test-runner hang; the fresh attempt passed all gates.

### Host Identity / Environment Fingerprint v0.1

- Added privacy-first local host identity and environment fingerprinting.
- Added stable/volatile field separation and deterministic SHA-256 identity.
- Added explicit capability seams for platform, runtime, path semantics, clock, serialization, hashing, and opt-in environment data.
- Added sensitive environment-name rejection and bounded allowlists.
- Added immutable fingerprints, comparison semantics, canonical serialization, and tamper detection.
- Added cross-platform contract tests and runnable example.
