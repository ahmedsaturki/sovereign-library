# MIME / Multipart Cube v0.1

Native MIME helpers and a bounded asynchronous `multipart/form-data` parser/builder.

## Included

- MIME type normalization and parameter parsing
- multipart boundary validation
- async-iterable chunk parsing
- total, per-part, and header limits
- text field and binary file extraction
- `Content-Disposition` parsing
- immutable part metadata
- abort-aware parsing
- multipart body builder
- zero runtime third-party dependencies

The parser intentionally keeps v0.1 bounded and deterministic rather than attempting resumable uploads, object storage, transcoding, or distributed upload coordination.
