# Windows Browser Smoke Hardening v0.1

## Change

The Browser Cube adds `--disable-gpu` to Chromium-family headless launches on Windows (`process.platform === 'win32'`).

## Why

Hosted Windows CI repeatedly reached the browser smoke test with all preceding package, security, reproducibility, and test stages green, but Chromium did not expose CDP before the existing startup deadline. The earlier green Windows run demonstrated that the Browser contract itself is valid; this change targets the hosted Windows startup boundary without changing the test contract.

## Contract preservation

The change does not increase the browser startup timeout, bypass CDP checks, skip navigation/evaluation/metadata/screenshot assertions, or weaken cleanup. The smoke test still requires successful CDP startup, navigation to the local fixture, page evaluation, metadata, screenshot generation, and clean shutdown.

## Scope

This is a platform-specific startup compatibility hardening change. It is intentionally limited to Windows and leaves Linux/macOS Chromium launch arguments unchanged except for their existing behavior.