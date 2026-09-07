# ADR-0010 — Why GDPR automation is opt-in per data class

**Status:** Accepted
**Date:** 2026-09-07
**Deciders:** @sovereign/fellow-engineer, @sovereign/legal
**Consulted:** @sovereign/security-team
**Informed:** @sovereign/engineering-all

## Context

GDPR Art. 17 (right to erasure) and Art. 20 (data portability)
impose obligations on any system that processes personal data.
Sovereign cubes are general-purpose and process arbitrary data —
not all of it is personal data.

Mandating GDPR automation for every cube would impose cost without
benefit. But not having it at all leaves downstream products to
re-implement the controls.

## Decision

GDPR automation ships as **opt-in, per data class**. The
`privacy/gdpr-automation/policies/data-classes.json` declares
which data classes a cube handles. Cubes that declare a
`personal-data` class must wire the GDPR automation into their
output path. Cubes that handle only `non-personal` data are
exempt.

## Alternatives Considered

- **Always-on** — rejected; over-broad.
- **Never-on** — rejected; leaves downstream products exposed.

## Consequences

- Positive: targeted, principled coverage.
- Negative: requires a declaration per cube.

## References

- `privacy/gdpr-automation/README.md`