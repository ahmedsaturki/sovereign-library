# Fuzz Testing — AFL / libFuzzer

**Status:** Phase-3 / Continuity-Hardening Wave
**Tools:** AFL (american fuzzy lop), libFuzzer (LLVM), AFL++, honggfuzz

Sovereign cubes that consume external input are fuzz-tested:

| Surface                                | Fuzz target                                  |
|----------------------------------------|----------------------------------------------|
| `safe-path-resolver`                   | path inputs containing escapes / encodings   |
| `glob-path-matcher`                    | glob patterns                                 |
| `canonical-json`                       | JSON inputs                                   |
| `serialization`                        | nested objects, edge strings                  |
| `digest`                               | arbitrary bytes                               |
| `url`                                  | URL strings                                   |
| `compression`                          | arbitrary bytes, edge sizes                   |
| `http-metadata`                        | header strings                                |
| `diff-patch`                           | patch text, base text                          |
| `redaction`                            | arbitrary strings with sensitive markers     |

## Local runners

- `scripts/fuzz.mjs` — stdlib-only runner that mutates a seed corpus
  and feeds it to the target. Equivalent to dumb fuzzing.
- AFL / libFuzzer integration is provided as a harness stub under
  `harness/` for native compile targets.

## How to run

```
# stdlib fuzz runner
node scripts/fuzz.mjs --target cubes/safe-path-resolver-containment-boundary \
  --out .hermes/phase3/fuzz --duration 30
```

The runner emits a JSON transcript with the corpus path, the
mutation history, and any crash signatures.

## Coverage guidance

When AFL is available, the run should reach ≥ 70% line coverage on
the target cube. Coverage reports live under `reports/`.