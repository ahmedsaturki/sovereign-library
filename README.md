# Sovereign Library

A collection of **standalone, dependency-free software cubes** for building applications, tools, automations, agents, and products.

## The rule

Each cube is a complete product in its own right: independently usable, testable, documented, versioned, and replaceable. Cubes do not depend on other Sovereign cubes unless a contract explicitly says so.

We study proven implementations, open-source projects, standards, production failures, benchmarks, and expert practice. We extract useful ideas and implement the required capability as our own focused component. We do not copy code blindly; when source code is reused, applicable licenses and attribution requirements are preserved.

## Repository shape

```text
cubes/          standalone reusable products
contracts/      stable interchange contracts
adapters/       optional environment/external adapters
examples/       runnable examples
specs/          cube specifications and definition-of-done gates
tests/          repository verification
```

## Dependency policy

Target: **zero runtime third-party dependencies per cube**. Language standard libraries, operating-system primitives, open protocols, and web standards are allowed foundations. Third-party packages are not required by the core products.

A cube may use an external runtime such as Chromium when that external program is itself the capability being implemented (for example, Browser Cube uses Chromium through CDP), but the cube must not require a third-party automation framework or SDK.

## Cross-platform target

Windows, Linux, macOS, and WSL where the underlying capability is supported and verifiable.

## Release discipline

A cube is not released because source code exists. It is released only after contract tests, normal-path tests, failure/recovery tests, documentation, examples, clean-checkout verification, and platform checks pass.

The project follows one active cube at a time:

`SPEC -> IMPLEMENT -> TEST -> FIX -> VERIFY -> RELEASE -> FREEZE -> NEXT CUBE`

## Current status

**Browser Cube v0.1 — released.**

The first standalone browser product was verified through GitHub Actions on Windows, Linux, and macOS, including a real Chromium smoke test. The next active milestone is **HTTP Client Cube v0.1**.

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material and do not assume unrestricted redistribution rights.
