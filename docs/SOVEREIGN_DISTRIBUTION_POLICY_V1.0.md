# Sovereign Library — Free Multi-Channel Distribution Policy v1.0

## Purpose

Sovereign Library is designed around independent, real libraries. Distribution is not required to use one registry. The project may use multiple free public distribution channels when they are appropriate for an ecosystem and do not compromise independence, security, reproducibility, or maintainability.

## Permanent rule

`ONE CONTRACT -> NATIVE IMPLEMENTATION -> CONFORMANCE -> INDEPENDENT DISTRIBUTION`

A distribution channel is an implementation/distribution concern, not the source of truth for the library itself.

## Current policy

GitHub is the canonical project source, project-memory system, release-evidence home, and default distribution channel.

Free ecosystem registries are OPTIONAL distribution mirrors/consumer-facing channels. They may be enabled for a package when all of the following are true:

1. the channel is appropriate to the package's ecosystem;
2. the public use is available without a paid plan for the intended workload;
3. the package remains independently usable without that registry;
4. release artifacts are reproducible and identical in meaning/content to the verified GitHub artifact;
5. authentication and publishing can be automated safely, preferably through short-lived/trusted CI identity where supported;
6. registry-specific operational limits are understood before committing the project to the channel;
7. the distribution does not introduce unnecessary cost, lock-in, or security risk.

No external registry is mandatory.

## Current practical channels

### GitHub

Canonical for:

- source
- tags
- GitHub Releases
- release assets
- checksums/integrity
- release evidence
- project documentation
- persistent project state

GitHub Releases are the default artifact distribution mechanism.

GitHub Packages may be used when a native package-registry experience is useful. Public GitHub Packages are currently free under GitHub's published policy; current quotas/limits must be checked before sustained high-volume use.

### Node.js / JavaScript

The Node package format remains npm-compatible.

Potential free channels:

- npm public registry
- GitHub Packages npm registry
- GitHub Releases/source

npm public packages are available on npm's free service. Scoped public packages can use `npm publish --access public`; publication still requires the account's authentication/2FA policy to be satisfied.

JS/TS packages may also be evaluated for JSR where the package is ESM-compatible and the additional ecosystem value is real. Do not require JSR merely to increase registry count.

### Python

Use native Python packaging (`pyproject.toml`, wheels/source distributions) for Python implementations.

Potential free channels:

- PyPI
- GitHub Releases/source

PyPI provides free core publishing/installing at reasonable levels and supports Trusted Publishing from GitHub Actions using OIDC, which avoids long-lived API tokens.

### Kotlin / JVM / Android

Use native Gradle/Maven-compatible artifacts.

Potential free channels:

- Maven Central for ordinary community open-source publishing, subject to its current publishing limits and policy;
- GitHub Packages Maven/Gradle registries;
- GitHub Releases for JAR/AAR and source artifacts.

Maven Central remains free for ordinary community open-source publishing, but current limits and the October 1, 2026 rate-limiting policy must be checked before adopting it as a high-volume distribution channel.

Android artifacts must remain Android-native; do not represent a Node or Python package as an Android library.

### iOS / Apple platforms

Use native Swift-facing APIs and/or Kotlin Multiplatform where justified.

Potential free channels during early/community distribution:

- GitHub Releases/source
- Git-based distribution
- GitHub-hosted artifacts where technically appropriate

Do not invent a registry requirement for iOS packages.

## No-cost rule

The project prefers zero monetary cost, but "free" means more than `$0`:

- no mandatory paid plan;
- no unexpected paid storage/bandwidth requirement for intended use;
- no paid CI dependency introduced solely for publishing;
- no paid API dependency;
- no hidden commercial lock-in.

Usage limits and current provider policies must be rechecked at release time.

## Distribution hierarchy

1. GitHub source/release artifacts — canonical and always available.
2. Native free ecosystem registry — optional when valuable.
3. Additional free registries/mirrors — optional and only when they materially improve discoverability or installation.

Never remove GitHub distribution because another registry is available.

## Registry selection rule

Do not publish the same artifact to every registry mechanically.

Publish where users of that ecosystem naturally obtain the package:

- JavaScript -> npm/JSR/GitHub Packages when justified;
- Python -> PyPI/GitHub;
- JVM/Android -> Maven-compatible distribution/GitHub;
- platform-native ecosystems -> their appropriate native mechanism when it is free and genuinely useful.

## Security

Never commit credentials.

Prefer trusted publishing/OIDC when available.

Never bypass two-factor authentication or publication guards.

Registry credentials are external infrastructure, not project source code.

## Release identity

Every distribution of a release must resolve to the same authoritative release identity:

- source commit SHA;
- version;
- artifact checksum;
- public API;
- release notes;
- verification evidence.

A registry upload is a distribution event, not a separate implementation.

## Status terminology

`TECHNICALLY_READY` = verified as a library.

`GITHUB_RELEASE_CANDIDATE` = ready for GitHub Release.

`GITHUB_RELEASED` = GitHub Release and artifact verification completed.

`REGISTRY_RELEASED` = an additional ecosystem registry has been verified.

`FROZEN` = release state protected by project policy.

Never call a package `RELEASED` merely because a local build or `npm pack` succeeded.

## Current project phase

External registry publication is deferred by current project execution policy unless explicitly enabled for a specific release wave.

This document establishes that free registries are permitted in the future without changing the architecture or requiring paid services.

## Authoritative sources

- `AGENTS.md`
- `PROJECT_CONTROL.md`
- `ROADMAP.md`
- `docs/SOVEREIGN_ARCHITECTURE_CONSTITUTION_V1.0.md`
- `docs/SOVEREIGN_ECOSYSTEM_CONTRACT_V1.0.json`
- `docs/SOVEREIGN_PROJECT_KNOWLEDGE_BASE_V1.0.md`
- relevant package/release records
