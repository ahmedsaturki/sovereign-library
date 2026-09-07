# ADR-0007 — Why Zero Trust by default for all new HTTP surfaces

**Status:** Accepted
**Date:** 2026-09-07
**Deciders:** @sovereign/fellow-engineer
**Consulted:** @sovereign/security-team, @sovereign/sre
**Informed:** @sovereign/engineering-all

## Context

Perimeter security assumes the network is trusted. Sovereign cubes
ship to many deployment topologies — on-prem, cloud, hybrid, P2P.
A "trusted network" assumption cannot hold in this matrix.

## Decision

All new HTTP surfaces (cubes/http-server, cubes/websocket,
cubes/http) **must** be designed with Zero Trust principles:

- Mutual TLS or signed token on every connection.
- Per-request authorisation against an explicit allow-list.
- Short-lived credentials (≤15 min).
- Audit log of every request, signed by a per-process key.

The default for outbound requests: pin a server certificate and
verify both peer identity and SCT (Certificate Transparency).

## Alternatives Considered

- **Network-only controls** — rejected; fails the topology matrix.
- **Optional mTLS** — rejected; defaults matter more than policy.

## Consequences

- Positive: aligns with NCSC Zero Trust Architecture.
- Positive: reproducible authn / authz audit trail.
- Negative: requires more elaborate testing infrastructure.
- Reversibility: low; surface-level decision.

## References

- `architecture/zero-trust/README.md`
- `docs/rfc/RFC-0008-zero-trust-defaults.md`