# P2P Distributed Architecture

**Status:** Phase-3 / Continuity-Hardening Wave

Sovereign cubes can form a **peer-to-peer mesh** for offline or
edge deployments. This directory documents the transport, content
addressing, and conflict resolution.

## Stack

- **libp2p** — peer addressing, transport multiplexing (TCP, QUIC,
  WebRTC, WebSocket fallback).
- **IPFS** — content-addressed storage layer (optional).
- **Hyphal** — overlay data structure for gossip.

We deliberately do not depend on any of these libraries at
runtime; the `architecture/p2p-distributed/` directory holds
**integration contracts** — for products that need P2P, the
contract is implemented in the host.

## Mode: offline-first

When the network is down, a Sovereign cube must continue to
function:

- Local state is preserved.
- Writes are queued in a Merkle-DAG.
- On reconnect, the cube replays the queue against peers.
- Conflicts are resolved deterministically via CRDTs (per cube).

## Mode: pure P2P

No central server. Sovereign cubes discover peers via:

- mDNS / DNS-SD on local network.
- Kademlia DHT for global discovery.
- Bootstrap nodes listed in `architecture/p2p-distributed/libp2p/BOOTSTRAP.json`.

## Mode: hybrid

Default. Peers prefer local network; fallback to DHT; fallback to
a relay server listed in `architecture/p2p-distributed/libp2p/RELAY.json`.

## Conflict resolution

Per-cube CRDT choice:

| Cube                          | CRDT        |
|-------------------------------|-------------|
| `safe-path-resolver`          | immutable   |
| `file-lease-advisory-lock`    | OR-Set      |
| `atomic-file-writer`          | immutable   |
| `canonical-json`              | immutable   |
| `release-verification-harness`| OR-Set (nonces) |

## Implementation note

This is **architectural documentation** for the host product. The
Sovereign cubes themselves remain dependency-free; P2P wiring is
the consumer's responsibility.

## How to test

`scripts/p2p-mesh-test.mjs` spins up a 3-node mesh in-process and
verifies gossip converges within 5 seconds.