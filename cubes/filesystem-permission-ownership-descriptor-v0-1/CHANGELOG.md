# Changelog

## v0.1.0

- Added deterministic permission and ownership normalization across supported platforms.
- Added tri-state portable permission semantics and explicit Windows readonly handling.
- Added explicit ACL availability states and bounded deterministic platform flags.
- Added privacy-safe owner/group state classification with bounded opaque identifiers and opt-in disclosure.
- Added read-only `inspectPath` capability seams for lstat, platform, clock, hash, root resolution, containment validation, and cancellation.
- Added fail-closed relative-path, platform-mismatch, malformed-capability, bounds, and cancellation handling.
- Added PPO1 deterministic SHA-256 integrity-protected immutable serialization.
- Added bounded parsing, accessor/circular-input rejection, and typed errors.
