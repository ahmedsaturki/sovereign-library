# ADR-0005 — Why Phase-3 introduces formal verification

**Status:** Accepted
**Date:** 2026-09-07
**Deciders:** @sovereign/fellow-engineer
**Consulted:** @sovereign/security-team, @sovereign/qa
**Informed:** @sovereign/engineering-all

## Context

Phase-1 / Phase-2 rely on unit tests + property-based tests to
assert cube correctness. For seven safety-critical invariants
(safe-path containment, file-lease mutual exclusion,
recovery-journal durability, canonical-json determinism,
atomic-batch all-or-nothing, release-approval 4-eyes, and policy
deny-default), unit tests probe **specific** inputs. They cannot
prove the absence of bad behaviour across the **whole** input space.

A single missed branch in a unit test is enough to ship a
path-traversal or commit-torn-write vulnerability. We have seen
this in production cubes historically. Phase-3 must close this
gap.

## Decision

Adopt formal verification (TLA+ for protocol-style invariants, Coq
for type-driven invariants) as the **authoritative** correctness
argument for the seven invariants listed above.

- TLA+ proofs live in `formal-verification/tla/`.
- Coq proofs live in `formal-verification/coq/`.
- A formal-verification run is invoked by
  `scripts/formal-verify.mjs` and the witness is committed under
  `.hermes/phase3/formal/`.
- A failed proof **blocks release**.

## Alternatives Considered

- **SMT-only via cvc5 / z3** — rejected because the proof target
  needs both reachability (TLA+) and type-level (Coq) reasoning;
  splitting across SMT solvers does not give a unified story.
- **Model-based testing only (QuickCheck + stateful)** — rejected
  because property-based tests do not prove *every* input satisfies
  the invariant; they only sample.
- **Symbolic execution only (KLEE)** — rejected because the JS
  surfaces cannot be fully KLEE'd; we need a higher-level model.

## Consequences

- Positive: machine-checked proof for the seven invariants.
- Positive: regressions cannot silently re-introduce the bug.
- Negative: proof maintenance overhead. Each time the protocol
  changes, the proof changes.
- Reversibility: low. Removing formal verification would re-open
  the gap.

## References

- `formal-verification/README.md`
- `formal-verification/invariants/INDEX.md`
- `docs/rfc/RFC-0003-formal-verification-pipeline.md`