# Zero Trust Architecture

**Status:** Phase-3 / Continuity-Hardening Wave

Sovereign cubes adopt a **Zero Trust** posture by default for any
new HTTP surface. This document describes the principles and how
they map to our cube portfolio.

## Principles (per NIST SP 800-207)

1. **All data sources and computing services are considered
   resources.** A network location is not trust.
2. **All communication is secured regardless of network
   location.** mTLS or signed-token for every request.
3. **Access to individual enterprise resources is granted on a
   per-session basis.** Trust is established per request, not per
   connection.
4. **Access to resources is determined by dynamic policy.** The
   policy considers client identity, application, asset, and
   behavioural attributes.
5. **The enterprise monitors and measures the integrity and
   security posture of all assets.** No device is trusted just
   because it joined the network.
6. **All resource authentication and authorisation are dynamic
   and strictly enforced.** Identity verification happens at every
   hop.

## Mapping to Sovereign cubes

| Surface                            | Zero Trust control                            |
|------------------------------------|------------------------------------------------|
| `cubes/http-server`                | mTLS, signed-token authz, short-lived creds    |
| `cubes/http-client`                | Pin server cert; verify SCT; deny loopback     |
| `cubes/websocket`                  | Signed subprotocol token; per-message authz     |
| `cubes/policy-capability-security` | Per-request allow-list evaluation              |
| `cubes/release-verification-harness`| Per-request manifest verification             |
| `cubes/redaction`                  | Strip PII before logging                       |

## Configuration

The Zero Trust configuration lives at
`architecture/zero-trust/config.json`. Defaults are deny-all; a
cube opts into individual resource access via a manifest.

## Run evidence

```
node scripts/zero-trust-check.mjs --out .hermes/phase3/zero-trust
```

Emits a transcript per cube with the controls observed and the
gaps. CI fails if any gap is "high".