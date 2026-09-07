# Differential Testing

**Status:** Phase-3 / Continuity-Hardening Wave

Differential testing verifies that two implementations of the **same
contract** agree on the same inputs. If they disagree, at least one is
buggy; if they always agree, the contract is at least *partially*
explored.

## Pairs

We run differential tests across:

| Pair                                | What is being compared                       |
|-------------------------------------|----------------------------------------------|
| Node stdlib `crypto.createHash`     | vs. canonical-json's internal digest calls   |
| Sovereign `canonical-json`          | vs. `JSON.stringify` after key sort          |
| Sovereign `digest` cube             | vs. stdlib `crypto.hash`                     |
| Sovereign `url` cube                | vs. `URL` constructor on URL spec inputs     |
| Sovereign `serialization` cube      | vs. `JSON.stringify` / `JSON.parse`         |
| Sovereign `safe-path-resolver`      | vs. POSIX `realpath` on POSIX-safe inputs    |
| Sovereign `glob-path-matcher`       | vs. minimatch semantics (we ship our own)    |
| Sovereign `diff-patch` cube         | vs. RFC 6902 JSON-Patch sample vectors       |
| Sovereign `compression` cube        | vs. `zlib` roundtrip                         |

Each pair is defined as a small fixture file under `pairs/`.

## How to run

```
node scripts/differential.mjs --out .hermes/phase3/differential
```

## Output

A JSON transcript per pair plus an aggregate `summary.json`.
Each pair produces:

- `agreement`: number of inputs where both implementations agree.
- `disagreement`: list of inputs and their observed outputs from each
  side, with diffs annotated.
- `pass`: true iff no disagreements.