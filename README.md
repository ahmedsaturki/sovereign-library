# Sovereign Library

A collection of **standalone, dependency-free software cubes** for building applications, tools, automations, agents, and products.

## The rule

Each cube is a complete product in its own right: independently usable, testable, documented, versioned, and replaceable. Cubes do not depend on other Sovereign cubes unless a contract explicitly says so.

We study proven implementations, open-source projects, standards, production failures, benchmarks, and expert practice. We extract the useful ideas and implement the required capability as our own focused component. We do not copy code blindly and we preserve applicable licenses when source is reused.

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

## Cross-platform target

Windows, Linux, macOS, and WSL where the underlying capability is supported.

## First release gate

A cube is not released because source code exists. It is released only after contract tests, normal-path tests, failure/recovery tests, documentation, examples, and platform checks pass.

## Current status

The repository is intentionally starting with the product contract and first standalone cube specification. We finish one cube before expanding the catalog.

## License

The project license will be selected before the first distributable public code release. Until then, treat this repository as source-available development material and do not assume unrestricted redistribution rights.
