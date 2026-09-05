# Cache / Memoization Cube v0.1

Standalone bounded in-memory cache using Node.js runtime primitives only.

## Contract

The cache provides:

- namespaces
- `get`, `set`, `has`, `delete`, `clear`
- TTL with an injectable clock
- bounded LRU-style eviction
- hit/miss/set/delete/eviction statistics
- predicate invalidation
- `getOrCompute` with in-flight de-duplication
- AbortSignal-aware computation
- immutable metadata snapshots

## Determinism

Tests inject a clock so expiration can be advanced without waiting on wall-clock time.

Within one namespace, a cache hit promotes an entry to the most-recent position. When capacity is exceeded, the least-recently-used entry is evicted.

## Scope boundary

v0.1 is process-local and in-memory. It does not persist values or coordinate between processes. Redis, remote caches, replication, persistence, and cluster coordination are intentionally out of scope.
