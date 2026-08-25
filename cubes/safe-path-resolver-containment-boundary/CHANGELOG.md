# Changelog

## v0.1.0

- deterministic lexical path normalization and resolution
- segment-aware root containment
- POSIX, drive, UNC, and Windows namespace root handling
- explicit case policy
- lexical-only, reject-symlink, and follow-contained policies
- injectable filesystem canonicalization seams
- bounded inputs and typed failure modes
- SPR1 deterministic serialization with SHA-256 integrity verification
- fail-closed `INTEGRITY_FAILURE` tamper detection
- explicit bounded `symlinkDepth(path)` capability for follow-contained mode
- zero runtime third-party dependencies
