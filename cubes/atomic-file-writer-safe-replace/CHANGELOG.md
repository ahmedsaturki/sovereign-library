# Changelog

## v0.1.0

- atomic single-file replacement using same-directory candidates
- bounded byte and metadata inputs
- streaming writer form
- optional SHA-256 digest verification
- explicit permission policy modes
- explicit durability modes without overclaiming guarantees
- destination symlink rejection
- fail-closed candidate cleanup and error model
- deterministic filesystem, clock, identity, and fsync seams
- Node 24-compatible fsync capability implementation using promisified node:fs
- zero runtime third-party dependencies
