# ADR-0008 — Why ADR/RFC process introduced in Phase-3

**Status:** Accepted
**Date:** 2026-09-07
**Deciders:** @sovereign/fellow-engineer
**Consulted:** @sovereign/senior-engineer
**Informed:** @sovereign/engineering-all

## Context

Phase-0 / Phase-1 / Phase-2 made architectural choices inline —
captured only in commits and PR descriptions. New contributors
cannot easily reconstruct the *why* of historical decisions, and
proposals for changes sometimes contradict settled decisions
because no record exists.

## Decision

Adopt the MADR-aligned ADR process under `docs/adr/` and a
companion RFC process under `docs/rfc/`. ADRs are short records of
decision; RFCs are detailed proposals for changes that may need
review before merging.

- ADR template: `docs/adr/template.md`.
- RFC template: `docs/rfc/template.md`.
- A new ADR or RFC is opened as a PR and merged only after
  approval from a `@sovereign/decider`.

## Alternatives Considered

- **Issues-only** — rejected; GitHub Issues do not survive well
  as long-term memory.
- **Wikis** — rejected; not part of the repo, so they drift.

## Consequences

- Positive: institutional memory preserved.
- Negative: process overhead for trivial decisions (mitigated by
  ADR file size ≤ 200 lines).

## References

- `docs/adr/README.md`
- `docs/rfc/README.md`