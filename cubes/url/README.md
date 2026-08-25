# URL / Query / Encoding Cube v0.1

Native URL, query-string, form-encoding, UTF-8, Base64/Base64URL, and path-segment helpers.

Built entirely from ECMAScript / Node.js runtime primitives with zero runtime third-party dependencies.

## Included

- bounded URL parsing
- duplicate-preserving query parsing
- deterministic query/form building
- strict and tolerant percent decoding
- UTF-8 conversion
- Base64 and Base64URL
- `base64Decode()` / `base64UrlDecode()` return immutable-by-convention `Uint8Array` byte results
- path-segment encoding/decoding
- deterministic typed errors
- immutable parsed URL/query snapshots
