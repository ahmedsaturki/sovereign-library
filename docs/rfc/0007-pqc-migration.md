# RFC-0007 — Post-quantum migration plan

**Status:** Accepted
**Date:** 2026-09-07
**Authors:** @sovereign/fellow-engineer
**Reviewers:** @sovereign/security-team

## Summary

Migrate all Sovereign TLS surfaces to hybrid post-quantum (X25519
+ ML-KEM-768) by 2027-Q4, with pure PQ by 2028-Q4.

## Motivation

"Harvest now, decrypt later" attacks are a real and present
threat. NIST has standardised ML-KEM (FIPS 203) and ML-DSA (FIPS
204). Cloud providers have started deploying PQ TLS.

## Detailed Design

- 2026-Q3 — Phase-3 introduces the hybrid stack (`node:crypto`
  24.x).
- 2026-Q4 — Default for outbound; opt-in for inbound.
- 2027-Q1 — Default for inbound.
- 2027-Q4 — Hybrid mandatory.
- 2028-Q4 — Pure PQ allowed; X25519 fallback removed.

## Drawbacks

- Larger TLS handshake sizes (~1 KB per connection).
- Compatibility with browsers that haven't shipped PQ.

## Alternatives

- Wait for FIPS final (rejected).

## Open Questions

- What is the fallback if a peer's PQ suite is broken mid-migration?

## References

- `security/post-quantum/README.md`
- ADR-0006