# File Lease / Advisory Lock v0.1

A standalone cooperative filesystem lease for local resource exclusion. It owns a sidecar lock directory, not the protected resource itself.

## API

```js
import { acquireLease } from './src/index.js';

const lease = await acquireLease({
  resourcePath: '/workspace/job-output.json',
  ttlMs: 30_000,
  staleRecovery: true,
  owner: { role: 'worker' },
});

try {
  // Cooperating processes honor the advisory lease.
} finally {
  await lease.release();
}
```

### Semantics

- Atomic acquisition uses filesystem directory creation (`mkdir` without recursive creation).
- A successful lease owns a unique owner record inside the sidecar lock directory.
- A second contender receives typed `LOCK_BUSY` rather than `acquired`.
- `release()` removes only the current lease's owner record, then removes the lock directory only when it is empty. This prevents an old lease from deleting a successor owner's lock after recovery.
- TTL is optional. With TTL enabled, `renew()` extends the lease only while the current owner record is still valid.
- Stale recovery is opt-in and renames an expired lock directory to a quarantine name before creating the successor lock.
- Timestamps are expiry metadata, not unique ownership proof.

## Integrity and bounds

Lock records use the versioned `FLC1` envelope with SHA-256 over a canonical JSON payload. Records, paths, owner metadata, and capability inputs are bounded and fail closed on malformed, accessor-backed, circular, unsupported, or oversized values.

## Capability seams

Tests may inject a `clock`, `uuid` function, and filesystem capability object. These are execution capabilities, not configuration data, so they are validated by shape and are never frozen or traversed as ordinary JSON.

## Crash/stale limitation

This is an **advisory** cooperative lease. Programs that ignore the protocol are not blocked. A terminated process may leave an abandoned lock; recovery occurs only when TTL is configured and `staleRecovery` is explicitly enabled.

## Cross-platform status

The cube targets Ubuntu, Windows, macOS-15-Intel, and relevant WSL boundaries using Node.js standard-library filesystem primitives. Platform-specific filesystem semantics remain part of the documented contract.

## Dependency status

Zero runtime third-party dependencies.
