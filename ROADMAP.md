# Sovereign Library Roadmap

## Release discipline

One active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

A cube is released only after clean syntax checks, unit/contract tests, integration tests, failure/recovery tests, documentation, examples, and GitHub CI across the supported platform matrix pass.

## Released

All previously released cubes remain frozen on `main`, including Timeout / Deadline v0.1 and HTTP Server / Router v0.1.

HTTP Server / Router v0.1 was verified on Ubuntu, Windows, and macOS-15-Intel with syntax, contract/integration, failure/recovery coverage, and the real Browser smoke test. Release-gate Run 240 passed all jobs and the cube was squash-merged as `77a668d5b56591b62f748b16235a318b3be724c3`.

## Active milestone

### MIME / Multipart Cube v0.1

Target: a standalone native MIME and `multipart/form-data` parser/builder using only Node.js language/runtime primitives, designed for file uploads and structured HTTP payloads without a third-party multipart framework.

Initial scope:
- MIME type parsing and normalization
- multipart boundary validation
- streaming-safe multipart parsing
- bounded total and per-part sizes
- text field extraction
- binary file-part extraction
- content-disposition parsing
- header normalization and limits
- deterministic malformed-input errors
- multipart body builder for client requests
- immutable part metadata snapshots
- cleanup/cancellation during streaming parse
- local unit/integration/failure/recovery tests
- cross-platform verification

Out of scope until v0.2+:
- multipart compression
- resumable uploads
- remote object storage
- antivirus scanning
- image/video transcoding
- distributed upload coordination
- third-party multipart parsers

## Parked

Ideas discovered during research remain parked until the active cube is released. Do not expand the active cube with unrelated capabilities.
