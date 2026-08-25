# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

All previously released cubes remain frozen on `main`, including HTTP Metadata v0.1.

HTTP Metadata v0.1 was verified on Ubuntu, Windows, and macOS-15-Intel with HTTP metadata contract/integration/failure tests and the real Browser smoke test. Release-gate Run 254 passed all jobs and the cube was squash-merged as `04a67f7ca79624545601cd827e455b14f01a427a`.

## Active milestone

### URL / Query / Encoding Cube v0.1

Target: a standalone native URL, query-string, percent-encoding, form-encoding, and byte-safe text conversion primitive usable by every HTTP/data/automation cube without a third-party URL or encoding framework.

Initial scope:
- URL parsing and serialization helpers
- strict and tolerant percent-decoding
- RFC-style query parameter parsing with duplicate keys
- deterministic query builder
- application/x-www-form-urlencoded encode/decode
- UTF-8 encode/decode helpers
- Base64 / Base64URL helpers
- safe path-segment encoding/decoding
- bounded input size limits
- immutable parameter snapshots
- deterministic malformed-input errors
- local unit/integration/failure/recovery tests
- cross-platform verification

Out of scope until v0.2+:
- DNS resolution
- URL fetching
- URI templates
- cryptographic signing schemes
- IDNA implementation
- third-party parsers/encoders

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
