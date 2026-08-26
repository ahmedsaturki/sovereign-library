# Sovereign Library — Legal & Distribution Policy v0.1

## Decision

Sovereign Library is licensed under the **Apache License, Version 2.0** for the repository source and distributable components, subject to the scope and ownership notes below.

## Why Apache-2.0

- Permissive commercial and internal use.
- Explicit patent license and patent-termination language.
- Compatible with standalone reusable infrastructure and ecosystem adoption.
- Clear redistribution and NOTICE obligations.
- Suitable as a foundation for future independent `@sovereign/*` packages.

## Distribution boundary

This decision authorizes licensing; it does **not** authorize publication to npm or another registry by itself.

Public package publication remains a separate gated task requiring, at minimum:

1. Stable public API boundary.
2. Package metadata and exports contract.
3. Type/declaration strategy.
4. Reproducible `npm pack` verification.
5. Dependency and security review.
6. Versioning/publishing policy.
7. CI publication controls.

## CI publication invariant

Every distributable-package change must pass the repository release verification workflow on the supported platform matrix before publication. A technically complete package without a green CI gate is not publishable.

## Ownership and contributions

Project attribution is recorded in `NOTICE`. Contributions intentionally submitted for inclusion are governed by Apache-2.0 unless a separate written agreement states otherwise.

## Third-party material

Each future package must preserve applicable third-party notices and license metadata for any dependency or vendored material introduced into that package. The current runtime policy remains zero third-party runtime dependencies per cube unless an explicit documented decision changes that policy.

## Effective point

This policy becomes authoritative only when the corresponding License PR is merged to `main`.
