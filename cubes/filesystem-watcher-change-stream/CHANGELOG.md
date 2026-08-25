# Changelog

## v0.1.0

- standalone read-only filesystem change stream
- native `fs.watch` adapter with normalized created/changed/removed events
- explicit injected AsyncIterable source for deterministic tests
- immutable bounded events with per-watcher sequence numbers
- bounded queue with explicit overflow policies
- lifecycle and idempotent close behavior
- optional bounded debounce
- root containment and path normalization
- fail-closed malformed, accessor, circular, duplicate, and oversized input handling
- zero runtime third-party dependencies
