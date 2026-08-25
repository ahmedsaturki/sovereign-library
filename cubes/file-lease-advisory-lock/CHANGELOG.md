# Changelog

## v0.1.0

- atomic sidecar-directory advisory lease acquisition
- immutable lease identities and bounded owner metadata
- typed busy, expiry, ownership-loss, release, and recovery errors
- optional TTL and renewal
- conservative opt-in stale recovery with quarantine rename
- successor-owner-safe release behavior
- FLC1 checksum-protected lock records
- deterministic capability seams for clock, uuid, and filesystem operations
- cross-platform, zero-runtime-dependency design

## Corrective hardening

- ownership verification now follows the active lock record after stale recovery so an old lease cannot renew against a quarantined successor
- stale recovery fails closed when a lock directory has no demonstrable owner record
- release preflights unexpected lock-directory entries and reports `RELEASE_FAILED` without deleting the current owner record
- added recovery and release regression coverage to the full repository test gate
