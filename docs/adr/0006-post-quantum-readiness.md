# ADR-0006 — Why TLS 1.3-only and post-quantum readiness now

**Status:** Accepted
**Date:** 2026-09-07
**Deciders:** @sovereign/fellow-engineer
**Consulted:** @sovereign/security-team
**Informed:** @sovereign/engineering-all

## Context

TLS 1.2 is still permitted by some legacy clients. NIST published
FIPS 203 (ML-KEM) and FIPS 204 (ML-DSA) in 2024. NIST recommends
migration to post-quantum primitives by 2030. "Harvest now, decrypt
later" attacks are already a realistic threat.

Sovereign cubes must not be on the wrong side of this migration.

## Decision

1. **TLS 1.3 only** for every new HTTP / WebSocket surface; TLS 1.2
   is allowed only for backward-compat with named legacy clients,
   enumerated in `security/post-quantum/configs/legacy-clients.json`.
2. **Hybrid post-quantum key exchange** — X25519 + ML-KEM-768 via
   `node:crypto` 24.x — is the default for outbound TLS.
3. **Migration plan** in `security/post-quantum/pqc-migration/PLAN.md`
   targets full PQ by 2027-Q4.

## Alternatives Considered

- **Wait for NIST final guidance** — rejected. Harvest-now is real.
- **Pure ML-KEM (no X25519 fallback)** — rejected; loses
  compatibility with browsers that haven't shipped PQ yet.
- **TLS 1.2 still allowed** — rejected; lowers baseline.

## Consequences

- Positive: forward secrecy against quantum adversaries.
- Positive: clearer threat model.
- Negative: requires updates in `cubes/http` and `cubes/websocket`.
- Reversibility: medium. Hybrid mode is a configuration knob.

## References

- `security/post-quantum/README.md`
- `docs/rfc/RFC-0007-pqc-migration.md`