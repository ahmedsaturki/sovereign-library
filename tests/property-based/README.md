# Property-Based Testing

**Status:** Phase-3 / Continuity-Hardening Wave
**Stack:** `node:test` driver with custom `property` harness (Hypothesis /
QuickCheck style) — chosen because the Sovereign Library is dependency-
free. The harness lives in `tests/property-based/properties/property.mjs`
and operates against generators + shrinkers written in stdlib.

The Sovereign Library uses property-based testing to assert that
cubes satisfy **invariants** under randomised inputs, not just the
specific cases enumerated in their unit tests.

## Why a stdlib harness?

Every Sovereign cube is dependency-free. Pulling Hypothesis (Python)
or fast-check (npm) would violate the dependency-free contract.
Instead, the harness:

- Pulls **arbitrary generators** from `generators/`.
- Shrinks failures back to a minimal case using **shrinker
  strategies** recorded in the generator.
- Reports the failure with the **seed** so the run is reproducible.

## Cube coverage

| Cube                          | Property file                              |
|-------------------------------|--------------------------------------------|
| safe-path-resolver            | properties/safe-path-resolver.prop.mjs     |
| file-lease-advisory-lock      | properties/file-lease.prop.mjs             |
| canonical-json                | properties/canonical-json.prop.mjs         |
| atomic-batch-file-transaction | properties/atomic-batch.prop.mjs           |
| glob-path-matcher             | properties/glob-path-matcher.prop.mjs      |
| rate-limiter                  | properties/rate-limiter.prop.mjs           |
| circuit-breaker               | properties/circuit-breaker.prop.mjs        |
| retry                         | properties/retry.prop.mjs                  |
| timeout-deadline              | properties/timeout-deadline.prop.mjs       |
| serialization                 | properties/serialization.prop.mjs          |
| url                           | properties/url.prop.mjs                    |
| digest                        | properties/digest.prop.mjs                 |
| validation                    | properties/validation.prop.mjs             |
| redaction                     | properties/redaction.prop.mjs              |

## How to run

```
npm run test:property            # runs every *.prop.mjs with default 200 cases
npm run test:property -- --cases 1000 --seed 0xC0FFEE
```

## Run output

Each run writes a transcript under `.hermes/phase3/property/` keyed by
test file. A passing run is the source-of-truth; the JSON transcript
records the seed, the number of cases, and any shrinks applied.