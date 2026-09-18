# RFC-0005 — Bug-bounty program scope

**Status:** Accepted
**Date:** 2026-09-07
**Authors:** @sovereign/fellow-engineer
**Reviewers:** @sovereign/security-team, @sovereign/legal

## Summary

The Sovereign Library runs a public bug-bounty program scoped to
the cubes under `cubes/`, with a focus on safety-critical cubes
listed in `security/threat-modeling/registry.json`.

## Motivation

External security researchers find bugs internal teams miss. A
public program improves credibility and coverage.

## Detailed Design

- Scope: all `cubes/*/src/index.js` and the dependencies they
  transitively use.
- Out of scope: `tests/`, `examples/`, performance fixtures.
- Severity mapping: critical / high / medium / low → $5k / $1k /
  $250 / $50.
- Triage SLA: 24h acknowledgement, 7d severity confirmation.
- Disclosure: 90d coordinated disclosure.

## Drawbacks

- Cost of bounties.
- Risk of disclosure leak before patch.

## Alternatives

- Closed-only program (rejected — too narrow).

## Open Questions

- Whether to widen scope to consumers of the cubes (no).

## References

- `security/bug-bounty/README.md`
- `.well-known/security.txt`