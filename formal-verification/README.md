# Formal Verification — TLA+ and Coq

**Status:** Phase-3 / Continuity-Hardening Wave
**Stack:** TLA+ (Lamport) for distributed / concurrent protocol models; Coq
(Rocq) for invariant / type-system proofs; TLC model checker; Coq stdlib +
Coq.extlib + math-comp.

Sovereign cubes whose behaviour is safety- or liveness-critical are
verified through machine-checked proof, not unit test alone. Unit tests
probe specific inputs; formal verification proves whole classes of
behaviour cannot occur.

## Scope

This directory covers the seven safety-critical invariants the
release-engineering hardener cannot accept on the basis of unit tests
alone:

| Invariant                       | Where it lives                | Checker     |
|---------------------------------|-------------------------------|-------------|
| `SafePath` containment           | `tla/SafePath.tla`            | TLC         |
| `SafePath` monotonic-allow-list | `tla/SafePath.tla`            | TLC         |
| `FileLease` mutual exclusion    | `tla/FileLease.tla`           | TLC         |
| `FileLease` liveness            | `tla/FileLease.tla`           | TLC         |
| `RecoveryJournal` durability    | `tla/RecoveryJournal.tla`     | TLC         |
| `RecoveryJournal` idempotence   | `tla/RecoveryJournal.tla`     | TLC         |
| `CanonicalJson` byte-for-byte   | `coq/CanonicalJson.v`         | Coq         |
| determinism                    |                               |             |
| `AtomicBatch` all-or-nothing    | `coq/AtomicBatch.v`           | Coq         |
| `AtomicBatch` no torn writes    | `coq/AtomicBatch.v`           | Coq         |
| `ReleaseApproval` 4-eyes rule   | `coq/ReleaseApproval.v`       | Coq         |
| `ReleaseApproval` no replay     | `coq/ReleaseApproval.v`       | Coq         |
| `PolicyCapability` deny-default | `coq/PolicyCapability.v`      | Coq         |

A property is **checked** only if both:

1. The script under `scripts/formal-verify.mjs` invokes the prover
   against the proof file and emits a non-zero exit on failure.
2. The witness transcript under `.hermes/phase3/formal/*.transcript`
   is committed alongside the proof.

## Tools

- **TLA+** + **TLC** — bundled with the TLA+ toolbox, or installed via
  `brew install tla-plus-toolbox` (macOS) / `apt install tla+
  -toolbox` (Linux) / manual JAR drop into `tools/tla2tools.jar`.
- **Coq** (Rocq) 8.20+ — `opam install rocq-prover`.
- **math-comp** 1.16+ — for the arithmetic lemmas in `coq/`.

The Sovereign continuous-integration runner does **not** execute the
provers from CI by default — proof-checking is local-only and
witnessed by an operator commit. This is a deliberate decision: proof
failures should block releases on `feat/continuity-hardening`, not
every PR.

## Reproducing proofs

```
# All proofs
npm run formal:verify -- --out .hermes/phase3/formal

# TLA+ only
node scripts/formal-verify.mjs --tool tla --out .hermes/phase3/formal

# Coq only
node scripts/formal-verify.mjs --tool coq --out .hermes/phase3/formal
```

## Conventions

- Every `.tla` module begins with `EXTENDS Naturals, Sequences,
  FiniteSets, TLC` (or the minimum the spec needs).
- Every `.v` Coq file ends with a `(* CHECKED *)` comment so the
  orchestrator can confirm it is the proof file, not a stub.
- Proof files pin their prover version in the file header — `# TLA+
  2.20 / TLC 2.20` / `(* Coq 8.20.1 *)` — so a silent upgrade cannot
  change proof semantics.
- `formal-verification/invariants/` carries the **prose** version of
  each invariant as a teaching artifact.

## What is NOT formalised

Per AGENTS.md / GOVERNANCE.md / PROJECT_CONTROL.md:

- UI cubes — too high-cardinality, formalisation adds nothing.
- Performance benchmarks — already covered by `perf-compare.mjs`.
- Conformance vectors — already covered by `run-conformance.mjs`.
- Anything that requires reasoning about runtime clock skew beyond
  the `ClockModule` abstraction.

See `formal-verification/invariants/INDEX.md` for the prose
invariants.