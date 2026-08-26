# Changelog

## v0.1.0

- Added deterministic permission and ownership normalization across supported platforms.
- Added explicit capability reporting for mode bits, owner/group IDs and names, Windows readonly semantics, and native ACL evidence.
- Added privacy-safe owner/group name handling with SHA-256 redaction by default.
- Added read-only `inspectPath` capability seam using `lstat`.
- Added PPO1 deterministic SHA-256 integrity-protected immutable serialization.
- Added bounded parsing, accessor/circular-input rejection, and typed errors.
