# sovereign-cache (Python)

Native Python implementation of the **CACH1** cache contract from Sovereign Library.

- **Dependency-free**: standard library only.
- **Independent**: usable outside the monorepo. No Node runtime required.
- **Contract-conformant**: matches the Node `@sovereign/cache` behavior (verified by native pytest).

TTL cache with namespace isolation, LRU-style eviction (oldest-first), hit/miss/eviction
stats, and single-flight async `getOrCompute` (concurrent callers share one in-flight
computation). This is a **native** implementation — it does not wrap the Node cube.

## Use

```python
from sovereign_cache import Cache

cache = Cache({"namespace": "sess", "maxEntries": 100})
cache.set("k", {"v": 1}, {"ttlMs": 5000})
cache.get("k")          # {"v": 1}
cache.has("k")         # True
cache.stats()           # {hits, misses, evictions, sets, deletes, size, inFlight}
```

## Verify

```bash
python -m pytest tests -q
```

Distribution policy: GitHub canonical. PyPI publication is optional and separate.
