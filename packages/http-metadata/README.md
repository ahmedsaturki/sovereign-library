# HTTP Headers / Cookies / Content Negotiation Cube v0.1

Native HTTP metadata helpers with zero runtime third-party dependencies.

## Included

- case-insensitive header map with deterministic multi-value semantics
- safe header name/value validation
- Cookie parsing and Set-Cookie building
- Content-Type / Content-Length helpers
- Accept / Accept-Encoding / Accept-Language negotiation
- ETag generation and conditional matching
- immutable snapshots

The cube intentionally excludes cookie persistence, authentication/session state, compression, proxy behavior, and browser cookie-policy emulation.

The implementation follows the HTTP semantics defined by RFC 9110 and the Cookie / Set-Cookie model defined by RFC 6265.
