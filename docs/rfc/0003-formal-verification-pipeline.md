# RFC-0003 — Formal verification pipeline

**Status:** Accepted
**Date:** 2026-09-07
**Authors:** @sovereign/fellow-engineer
**Reviewers:** @sovereign/security-team, @sovereign/qa

## Summary

This RFC describes the formal-verification pipeline: where proofs
live, how they are run, and what counts as a passing run.

## Motivation

Phase-2 unit tests are necessary but not sufficient for
safety-critical cubes. A unit test cannot prove the absence of
all bugs in a protocol-style invariant. We need machine-checked
proofs.

## Detailed Design

- TLA+ specs under `formal-verification/tla/`.
- Coq proofs under `formal-verification/coq/`.
- `scripts/formal-verify.mjs` invokes TLC / coqc.
- A passing run produces a transcript under
  `.hermes/phase3/formal/<proof>.transcript`.
- A proof with no `(* CHECKED *)` marker is rejected as stale.

## Drawbacks

- Proof maintenance overhead.
- Prover upgrades must be re-verified.

## Alternatives

- SMT-only (rejected — see ADR-0005).

## Open Questions

- Should proofs be checked in CI? Current answer: no, operator-led.

## References

- `formal-verification/README.md`
- ADR-0005