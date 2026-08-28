# Storage Cube v0.1

Standalone local key/value storage built only on Node.js standard-library primitives.

## Runtime contract

- `Storage({ root, maxValueBytes })`
- `await store.init()`
- `await store.set(namespace, key, value, { ttlMs })`
- `await store.get(namespace, key)`
- `await store.has(namespace, key)`
- `await store.delete(namespace, key)`
- `await store.list(namespace)`
- `await store.info(namespace, key)`

Values are JSON-serializable. Keys and namespaces are constrained to safe single path components. Records include a version, original key, creation timestamp, and optional expiry timestamp. Corrupt JSON/record envelopes are surfaced as deterministic `StorageCubeError` values rather than silently discarded.

Persistence uses a temporary file followed by rename. On platforms that reject replacement of an existing target, the implementation uses an explicit replace fallback; callers should treat the write as crash-safe with respect to partial-file contents, not as a distributed transaction.

## Dependencies

No third-party runtime dependencies.
