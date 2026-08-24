# Standalone Browser Cube v0.1 Specification

## Goal

Provide a self-contained browser automation product implemented directly against browser-standard/native protocols instead of depending on Puppeteer, Playwright, Selenium, or another browser automation framework.

## v0.1 scope

- launch a supported Chromium-family browser
- connect through Chrome DevTools Protocol
- create and manage an isolated automation session
- discover and select a page target
- navigate to a URL
- evaluate JavaScript in the page
- retrieve basic page metadata
- take a screenshot
- close and clean up all owned resources
- expose deterministic CLI and programmatic interfaces

## Explicit non-goals for v0.1

- anti-bot bypass
- CAPTCHA solving
- platform-specific social-network automation
- stealth claims
- distributed browser farm
- full DOM selector engine
- downloads/uploads orchestration
- network interception
- proxy rotation

Those capabilities may become later independent products/cubes after v0.1 is proven.

## Independence

The Browser Cube MUST run without `@sovereign/core`, a third-party browser library, or another Sovereign cube. It may use the language standard library and the browser's supported protocol.

## Definition of Done

- clean checkout runs the example
- no runtime third-party dependency
- protocol errors are surfaced with stable error codes
- browser processes owned by the cube are always cleaned up
- session shutdown is idempotent
- invalid URLs are rejected
- timeouts are deterministic
- crash/partial-start cleanup is tested
- Windows/Linux/macOS/WSL behavior is documented and tested where a supported browser is available
- README contains a minimal runnable example
- tests cover success, timeout, protocol failure, missing target, and shutdown
- release artifact is reproducible
