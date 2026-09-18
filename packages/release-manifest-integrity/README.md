# Release Manifest / Integrity Cube v0.1

Standalone deterministic local manifest generation and integrity verification.

## Features

- Versioned canonical manifest format
- Stable POSIX path ordering
- Native SHA-256 digests
- Deterministic missing/extra/mismatch reports
- Bounded paths, entries, content, and manifest size
- Immutable public results
- Fail-closed malformed/accessor/unsafe input handling
- Zero runtime third-party dependencies

## API

```js
import { createManifest, verifyManifest, serializeManifest, parseManifest } from './src/index.js';
```

A manifest describes content using `{ path, content }` entries. Verification compares a stored manifest against a fresh entry set without modifying either input.