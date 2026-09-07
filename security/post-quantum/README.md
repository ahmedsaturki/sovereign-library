# Post-Quantum Cryptography Readiness

**Status:** Phase-3 / Continuity-Hardening Wave

This directory tracks Sovereign's migration to **post-quantum
cryptography** (PQC). The threat model is "harvest now, decrypt
later": adversaries record TLS traffic today, then decrypt it once
a quantum computer is available.

## Standards alignment

- **NIST FIPS 203** — ML-KEM (Module-Lattice-Based Key-Encapsulation),
  formerly CRYSTALS-Kyber. Default KEM.
- **NIST FIPS 204** — ML-DSA (Module-Lattice-Based Digital Signature),
  formerly CRYSTALS-Dilithium. Default signature.
- **NIST FIPS 205** — SLH-DSA (Stateless Hash-Based Signature),
  formerly SPHINCS+. FIPS-205-only fallback.
- **RFC 9370** — Hybrid key exchange in TLS 1.3.
- **IETF draft-ietf-tls-ecdhe-mlkem** — X25519 + ML-KEM-768 hybrid
  group.

## Migration phases

| Phase | Date       | Action                                          |
|-------|------------|-------------------------------------------------|
| 0     | 2026-Q3    | Inventory, registry, config (this directory)    |
| 1     | 2026-Q4    | Hybrid (X25519 + ML-KEM-768) default outbound   |
| 2     | 2027-Q1    | Hybrid default inbound                          |
| 3     | 2027-Q4    | Hybrid mandatory; pure-PQ opt-in                |
| 4     | 2028-Q4    | Pure-PQ allowed; X25519 fallback removed        |

## Stack

- **node:crypto 24.x** — `crypto.diffieHellman({ name: 'x25519' })`
  and `crypto.kem({ name: 'ml-kem-768' })`.
- **libsodium** (optional) — bindings to ML-KEM/ML-DSA via
  `libsodium-wrappers-sumo`.
- **AWS-LC / BoringSSL** — backend for `node:crypto`.

## Hybrid key exchange (X25519 + ML-KEM-768)

We use the IETF draft hybrid construction:

```
client_pubkey = concat(X25519_pubkey, ML-KEM-768_pubkey)
shared_secret = concat(X25519_shared, ML-KEM-768_shared)
derived_secret = HKDF-Expand(shared_secret, ...)
```

This is backward-compatible: a peer that supports only X25519
gets the X25519 shared secret; a peer that supports the hybrid
group gets both.

## Migration plan

The full plan is in `pqc-migration/PLAN.md`. It enumerates each
TLS surface, each signature surface, and each key-rotation
timeline.

## How to test

```
# Verify the libsodium binding loads
node security/post-quantum/configs/check-pq.mjs

# Verify the hybrid key derivation
node security/post-quantum/configs/hybrid-derive.mjs
```

These scripts emit a transcript under
`.hermes/phase3/post-quantum/`.