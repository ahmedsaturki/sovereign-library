# Open-Source Research Ledger

Purpose: study successful open-source projects and production patterns without turning Sovereign Library into a dependency wrapper.

## Rules

1. Research is continuous; a user-supplied link is useful but never required.
2. Extract behavior, architecture, tests, benchmarks, failure modes, APIs, and operational lessons.
3. Reimplement required capabilities as standalone Sovereign cubes using standard-library APIs, OS primitives, open protocols, and public standards whenever practical.
4. Do not copy source code blindly. Any source-code reuse requires license review and preservation of applicable notices/obligations.
5. Third-party runtime packages are not part of a cube's required runtime unless an explicit future exception is approved.

## Browser research

### gsd-browser
Native Rust browser automation over Chrome DevTools Protocol. Useful patterns: persistent daemon lifecycle, structured JSON/CLI envelopes, snapshots, ref-based actions, assertions, visual diffs, recordings, and explicit health/daemon commands. License: MIT OR Apache-2.0. Reference: https://github.com/gsd-build/gsd-browser

### cdp-browser
Lightweight CDP CLI without Puppeteer. Useful patterns: tab navigation, JavaScript evaluation, screenshots, interactive element picking, console/network observation, platform executable discovery, and native WebSocket support. License: MIT. Reference: https://github.com/sids/cdp-browser

### Public Browser
Direct-CDP browser automation emphasizing accessibility-tree references, cached snapshots, multi-tab operation, and token-efficient structured interaction. Useful patterns: stable refs, snapshot invalidation/refresh, local-only operation, and regression coverage. License: MIT. Reference: https://github.com/Silbercue/public-browser

### microsoft/vscode-cdp
Typed CDP connection patterns and extensible domain modeling. Useful lesson: keep protocol transport, connection lifecycle, domain contracts, and custom domains separable. License: MIT. Reference: https://github.com/microsoft/vscode-cdp

### browser-cdp
Real-browser/CDP operational ideas, including installed-browser discovery and profile-aware operation. Use only as behavioral reference; avoid adopting its automation-detection/evasion claims as a design goal. License: MIT. Reference: https://github.com/dpaluy/browser-cdp

## HTTP research

### nodejs/undici
High-performance HTTP/1.1 implementation written from scratch for Node.js. Useful lessons: connection management, pooling, pipelining, benchmarks, and performance testing. We do not import it into the HTTP Cube. Reference: https://github.com/nodejs/undici

### sindresorhus/got
Mature HTTP client with detailed request/response ergonomics, JSON helpers, streams, redirect handling, plugins, and comparison material. Useful as a behavior/reference matrix. License: MIT. Reference: https://github.com/sindresorhus/got

## Current Sovereign extraction priorities

Browser Cube: persistent session lifecycle, robust target/page state, snapshot/ref interaction model, deterministic assertions, diagnostics, and cross-platform executable/profile discovery.

HTTP Cube: timeout/cancellation correctness, redirect semantics, response-size limits, connection lifecycle, header normalization, stream/Buffer handling, and benchmark coverage.

Future cubes: execution engine, data engine, storage, scheduler, reporting, WebSocket, HTTP server, CLI, search, workflow, AI, and agents will each receive their own targeted research pass before implementation.
