# RFC-0008 — Zero Trust defaults for HTTP

**Status:** Accepted
**Date:** 2026-09-07
**Authors:** @sovereign/fellow-engineer
**Reviewers:** @sovereign/security-team, @sovereign/sre

## Summary

All new Sovereign HTTP surfaces must use Zero Trust defaults:
mutual TLS or signed token, per-request authz, short-lived
credentials, and audit logs.

## Motivation

Perimeter security does not work in our deployment matrix
(on-prem / cloud / hybrid / P2P). Zero Trust is the only model
that survives all four.

## Detailed Design

- mTLS by default; signed-token fallback for browser traffic.
- Per-request authz via `cubes/policy-capability-security`.
- Short-lived credentials issued by `cubes/auth-token` (new).
- Audit log written to `cubes/release-verification-harness`.

## Drawbacks

- Performance — extra round trips.
- Compatibility — requires newer clients.

## Alternatives

- Optional mTLS (rejected).

## Open Questions

- Whether to ship a default policy for authz or force declaration.

## References

- `architecture/zero-trust/README.md`
- ADR-0007