# HTTP Client Cube v0.1

## Product promise

A standalone native HTTP client for applications and tools, implemented with Node.js standard-library networking primitives. No Axios, undici package, got, request, SDK, or framework dependency.

## Released scope for v0.1

- HTTP and HTTPS requests
- GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS
- URL and method validation
- request headers
- string, Buffer, and JSON request bodies
- response status, headers, URL, and raw body
- text and JSON decoding helpers
- request timeout
- AbortSignal cancellation
- maximum response size
- explicit redirect policy
- deterministic typed errors
- request/response timing metadata
- local integration fixture tests
- clean example
- cross-platform CI

## Non-goals

HTTP/2, proxy pools, automatic cookie persistence, transparent retries, multipart abstractions beyond native primitives, authentication SDKs, and framework adapters are separate future slices.

## Independence

The cube MUST run and test without importing another Sovereign cube. It may be composed with other cubes by an application later, but its runtime implementation remains standalone.

## Definition of Done

- implementation uses only Node.js built-ins
- all public inputs validated
- network failures map to deterministic errors
- timeout and cancellation terminate the underlying request
- response limits are enforced before unbounded buffering
- redirects are explicit and bounded
- local fixture integration tests pass
- failure tests pass
- Windows/Linux/macOS CI passes
- example runs from a clean checkout
- documentation describes limits and non-goals
