# Post-Quantum Migration Plan

**Status:** Phase-3 / Continuity-Hardening Wave
**Owner:** @sovereign/fellow-engineer
**Co-owner:** @sovereign/security-team

## Scope

Every TLS surface in Sovereign cubes, every signature key, and
every at-rest encryption key. Specifically:

| Surface                  | Algorithm today | Target             |
|--------------------------|------------------|--------------------|
| `cubes/http-server`      | TLS 1.3 X25519 + Ed25519 | TLS 1.3 X25519 + ML-KEM-768, Ed25519 + ML-DSA-65 |
| `cubes/http-client`      | TLS 1.3 X25519  | TLS 1.3 X25519 + ML-KEM-768 |
| `cubes/websocket`        | TLS 1.3 X25519  | TLS 1.3 X25519 + ML-KEM-768 |
| `cubes/release-verification-harness` | Ed25519 | Ed25519 + ML-DSA-65 (dual-signed) |
| at-rest                  | AES-256-GCM     | AES-256-GCM (unchanged) |

## Phases

### Phase 0 — Inventory (now)

- Document current algorithms.
- Add the `pqc-config.json` registry.
- Add `legacy-clients.json` allow-list.
- Add `check-pq.mjs` and `hybrid-derive.mjs` harnesses.

### Phase 1 — Default outbound hybrid (2026-Q4)

- Outbound TLS negotiates X25519MLKEM768 first; X25519 fallback.
- Signature keys remain Ed25519.

### Phase 2 — Default inbound hybrid (2027-Q1)

- Inbound TLS accepts X25519MLKEM768 first; X25519 fallback.
- Per-cube config flips automatically.

### Phase 3 — Hybrid mandatory (2027-Q4)

- X25519 fallback is removed from the default config.
- `legacy-clients.json` is empty.

### Phase 4 — Pure-PQ (2028-Q4)

- X25519 fallback is removed from the codebase.
- ML-KEM-768 is mandatory.

## Rollback

Each phase has a feature flag:
- `SOV_PQ_HYBRID_OUTBOUND`
- `SOV_PQ_HYBRID_INBOUND`
- `SOV_PQ_REQUIRED`

Disabling a flag reverts to the previous phase without rebuild.

## Tracking

`scripts/pq-status.mjs` reads the live config and emits a status
transcript. CI fails if any cube is past its phase deadline.