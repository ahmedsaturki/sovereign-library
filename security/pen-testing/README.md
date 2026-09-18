# Penetration Testing

**Status:** Phase-3 / Continuity-Hardening Wave

Penetration testing scripts under `scripts/` exercise realistic
attack patterns against Sovereign cubes and surfaces. They are
**self-contained** — no external services required — and run as
part of the nightly CI schedule.

## Methodology

- **Black-box** — scripts do not depend on internal knowledge.
- **Hermetic** — every probe runs against a local harness or a
  pinned test endpoint. No live system is targeted.
- **Reproducible** — every run produces a transcript with seed,
  inputs, outputs, and findings.

## Scripts

| Script                                | Surface                                        |
|---------------------------------------|------------------------------------------------|
| `pen-test/path-traversal.mjs`         | safe-path-resolver                             |
| `pen-test/injection.mjs`              | canonical-json, serialization                  |
| `pen-test/timing-attack.mjs`          | digest, hash-equality                          |
| `pen-test/zip-bomb.mjs`               | compression, bounded-file-content-reader       |
| `pen-test/resource-exhaustion.mjs`    | rate-limiter, circuit-breaker                  |
| `pen-test/ssrf.mjs`                   | http-client, http-server                       |
| `pen-test/deserialisation-bomb.mjs`   | canonical-json, serialization, diff-patch      |
| `pen-test/symlink-race.mjs`           | atomic-file-writer                             |
| `pen-test/header-smuggle.mjs`         | http-server, http-metadata                     |
| `pen-test/replay-attack.mjs`          | release-approval, file-lease                  |
| `pen-test/sqli-simulation.mjs`       | search-index                                   |

## Severity matrix

| Severity | Definition                                                    |
|----------|----------------------------------------------------------------|
| Critical | Remote code execution, full auth bypass                       |
| High     | Significant data exposure or integrity loss                    |
| Medium   | Limited data exposure; mitigated by Zero Trust defaults        |
| Low      | Information leak; observability concerns                       |
| Info     | Best-practice deviation                                        |

## Run output

Each script writes a transcript under
`.hermes/phase3/pen-test/<script>.transcript.json` with:

- run metadata (timestamp, commit, seed),
- findings (severity, location, evidence),
- summary counters.