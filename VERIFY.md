# Release Verification Record

This file is intentionally small. It records the current release gate without adding runtime behavior.

For Browser Cube v0.1, release requires:

- syntax check
- unit/contract tests
- real Chromium smoke test
- deterministic local fixture (no external network dependency)
- cleanup verification
- Windows, Linux, macOS CI matrix
