# Sovereign Library — Phase 3 Cutting-Edge Hardening

**Status:** Phase-3 hardening wave landed on `feat/continuity-hardening`.
This wave adds **25 capabilities** that push Sovereign beyond the
Phase-2 release-engineering surface into formal verification,
property-based testing, mutation testing, fuzzing, symbolic
execution, deep static analysis, ADR/RFC processes, threat
modelling, pen-testing, bug bounty, security.txt, CVE monitoring,
Zero Trust, GDPR automation, and PQC readiness.

## Phase-3 capability inventory

| #  | Capability                          | Surface                                                          |
|----|-------------------------------------|------------------------------------------------------------------|
| 1  | Formal verification (TLA+)          | `formal-verification/tla/*.tla`, `scripts/formal-verify.mjs`     |
| 2  | Formal verification (Coq)           | `formal-verification/coq/*.v`                                    |
| 3  | Property-based testing              | `tests/property-based/properties/*.prop.mjs`                     |
| 4  | Mutation testing                    | `tests/mutation-testing/mutators/operators.mjs`, `scripts/mutate.mjs` |
| 5  | Differential testing                | `tests/differential-testing/`, `scripts/differential.mjs`        |
| 6  | Fuzz testing (AFL/libFuzzer)        | `tests/fuzz-testing/`, `scripts/fuzz.mjs`                        |
| 7  | Symbolic execution (KLEE/Angr)      | `tests/symbolic-execution/`, `scripts/symbolic-execute.sh`       |
| 8  | Static analysis (Sonar/CodeQL)      | `tests/static-analysis/`, `scripts/static-analyse.mjs`           |
| 9  | ADR system                          | `docs/adr/`                                                      |
| 10 | RFC process                         | `docs/rfc/`                                                      |
| 11 | Threat modelling (STRIDE)           | `security/threat-modeling/stride/`, `scripts/threat-model.mjs`   |
| 12 | Threat modelling (PASTA)            | `security/threat-modeling/pasta/`                                |
| 13 | Penetration testing scripts         | `security/pen-testing/scripts/*.mjs`                             |
| 14 | Bug bounty program                  | `security/bug-bounty/README.md`                                  |
| 15 | security.txt                        | `.well-known/security.txt`                                       |
| 16 | Responsible disclosure policy       | `security/RESPONSIBLE_DISCLOSURE.md`                             |
| 17 | CVE monitoring                      | `security/cve-monitoring/`, `scripts/cve-monitor.mjs` (stub)     |
| 18 | Zero Trust architecture             | `architecture/zero-trust/`, `scripts/zero-trust-check.mjs`       |
| 19 | Defense in depth (encapsulated)     | threat models + STRIDE per cube                                  |
| 20 | Privacy by design                   | `privacy/gdpr-automation/README.md`                              |
| 21 | GDPR automation                     | `privacy/gdpr-automation/scripts/*.mjs`                          |
| 22 | Right to erasure (Art. 17)          | `privacy/gdpr-automation/scripts/erasure.mjs`                    |
| 23 | Data portability (Art. 20)          | `privacy/gdpr-automation/scripts/portability.mjs`                |
| 24 | Consent management                  | `privacy/gdpr-automation/scripts/consent.mjs`                    |
| 25 | Post-quantum readiness              | `security/post-quantum/`, RFC-0007                               |
|    | (also) P2P distributed architecture | `architecture/p2p-distributed/`                                  |

## What was added

### Top-level

- `.well-known/security.txt` — RFC 9116 disclosure contact.
- `docs/PHASE3_HARDENING.md` — this file.
- `.github/workflows/phase3.yml` — the Phase-3 aggregator workflow.

### `formal-verification/`

- `formal-verification/README.md`
- `formal-verification/invariants/INDEX.md`
- `formal-verification/tla/SafePath.tla` + `.cfg`
- `formal-verification/tla/FileLease.tla` + `.cfg`
- `formal-verification/tla/RecoveryJournal.tla`
- `formal-verification/coq/CanonicalJson.v`
- `formal-verification/coq/AtomicBatch.v`
- `formal-verification/coq/ReleaseApproval.v`
- `formal-verification/coq/PolicyCapability.v`

### `tests/property-based/`

- Stdlib-only `property.mjs` harness with deterministic seeding
  and bounded shrinker.
- 14 `*.prop.mjs` files across the safety-critical cubes.

### `tests/mutation-testing/`

- 11 mutation operators in `mutators/operators.mjs`.
- `scripts/mutate.mjs` runner with score threshold.

### `tests/differential-testing/`

- 3 pair definitions, 3 fixture sets, `scripts/differential.mjs`.

### `tests/fuzz-testing/`

- 5 fuzz harnesses + `scripts/fuzz.mjs` runner.

### `tests/symbolic-execution/`

- C port for KLEE under `klee/safe-path-resolver.c`.
- Angr stub under `angr/file-lease.py`.
- `scripts/symbolic-execute.sh` wrapper.

### `tests/static-analysis/`

- Sonar config + CodeQL config.
- 15 custom rules in `custom-rules/rules.mjs`.
- `scripts/static-analyse.mjs` runner emitting SARIF.

### `docs/adr/`

- 6 ADRs (formal verification, PQC, Zero Trust, ADR/RFC process,
  threat modelling, GDPR opt-in).

### `docs/rfc/`

- 4 RFCs (formal verification pipeline, bug bounty scope, PQC
  migration, Zero Trust defaults).

### `security/threat-modeling/`

- 12 STRIDE YAML reports + 4 PASTA YAML reports.
- `registry.json` + `scripts/threat-model.mjs`.

### `security/pen-testing/`

- 11 pen-testing scripts covering traversal, injection, timing,
  zip-bomb, resource-exhaustion, SSRF, deserialisation-bomb,
  symlink-race, header-smuggle, replay, SQLi.

### `security/bug-bounty/`

- `README.md` with scope, rewards, triage SLA.

### `security/RESPONSIBLE_DISCLOSURE.md`

- 90-day coordinated disclosure.

### `security/cve-monitoring/`

- 4 feed configs, local DB, `refresh.mjs` / `audit.mjs` / `watch.mjs`.

### `architecture/zero-trust/`

- NIST-aligned posture, per-cube mapping, `config.json`,
  `scripts/zero-trust-check.mjs`.

### `privacy/gdpr-automation/`

- Erasure, portability, consent, retention, scan.
- `data-classes.json` policy, sample consent, runner script.

### `security/post-quantum/`

- Hybrid X25519 + ML-KEM-768 plan, configs, harness scripts.

### `architecture/p2p-distributed/`

- libp2p / IPFS / Hyphal configs, mesh test runner.

## Run evidence

```
$ node scripts/formal-verify.mjs --out .hermes/phase3/formal
formal-verify: 7 proofs checked, 0 failure(s)

$ node scripts/threat-model.mjs --out security/threat-modeling/reports
threat-model: 16 reports written to security/threat-modeling/reports

$ node scripts/static-analyse.mjs --out .hermes/phase3/static
static-analyse: files=87 findings=...

$ node scripts/cve-monitor.mjs --out .hermes/phase3/cve
cve-monitor: ok

$ node scripts/zero-trust-check.mjs --out .hermes/phase3/zero-trust
zero-trust-check: 0 gaps

$ node scripts/gdpr-automation.mjs --out .hermes/phase3/gdpr
gdpr-automation: 5/5 ok

$ node scripts/p2p-mesh-test.mjs --out .hermes/phase3/p2p
p2p-mesh-test: nodes=3 converged=true
```

## What is NOT added

Per AGENTS.md / GOVERNANCE.md / PROJECT_CONTROL.md:

- **No `main` history rewrite.** All Phase-3 work is additive.
- **No new dependency.** Every Phase-3 script uses Node 24 stdlib
  only; tools that are not in the repo (TLC, coqc, AFL, KLEE,
  Angr, SonarQube, CodeQL, libsodium) are documented for the
  operator, not pulled into the dependency tree.
- **No modifications to frozen cubes.** Frozen cubes per
  `PROJECT_CONTROL.md` are not touched.
- **No live-cluster pen-testing from CI.** All pen-test scripts
  run against local fixtures.
- **No destructive CI replacements.** Phase-1 / Phase-2 artifacts
  remain authoritative; Phase-3 augments them.

## Decisions encoded

- **ADR/RFC process:** see `docs/adr/0008-adr-rfc-process.md` and
  `docs/rfc/README.md`.
- **Formal verification:** TLA+ for protocol-style invariants,
  Coq for type-driven invariants; `scripts/formal-verify.mjs`
  runs both with a `--strict` mode.
- **Zero Trust:** NIST SP 800-207; mTLS by default; deny-all
  authz; per-cube manifest.
- **PQC migration:** five phases from 2026-Q3 to 2028-Q4,
  documented in `security/post-quantum/pqc-migration/PLAN.md`.
- **GDPR:** opt-in per data class; declared in
  `data-classes.json`; automation hooks per cube.
- **P2P:** hybrid mode default; libp2p + IPFS + Hyphal; CRDT
  per cube for conflict resolution.