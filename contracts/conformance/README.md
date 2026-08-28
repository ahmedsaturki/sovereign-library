# Language-Neutral Conformance

This directory holds **canonical conformance vectors** for Sovereign Library cubes that
are candidates for multi-ecosystem native ports (Python / Kotlin-JVM / Android / iOS).

## Why

Per the Sovereign directives, every suitable cube follows:

```
ONE AUTHORITATIVE CONTRACT
  -> NATIVE IMPLEMENTATION PER ECOSYSTEM
  -> CONFORMANCE
  -> INDEPENDENT DISTRIBUTION
```

Before a cube is ported to another language, we pin down a **language-neutral contract** and
**canonical expected outputs** derived from the canonical Node implementation. A native port
MUST satisfy the same vector file exactly. The vectors are facts (derived by real execution),
not guesses.

## Files

- `vectors.safe-path-resolver.json` — contract `SPR1`, package `@sovereign/safe-path-resolver`
- `vectors.runtime-capability-inspector.json` — contract `RCI1`, package `@sovereign/runtime-capability-inspector`

## Vector file schema

```json
{
  "contract": "<cube id>",
  "format": "<CONTRACT_FORMAT>",
  "package": "@sovereign/<cube>",
  "derivedFrom": "packages/<cube>/src/index.js (canonical Node implementation)",
  "vectors": [
    {
      "id": "unique-vector-id",
      "setup":  { "call": ["exportName", [args]] },        // optional: produced bound value $snapshot
      "serializeFirst": { "call": ["exportName", ["$snapshot"]] }, // optional: produced bound value $serialized
      "call": ["exportName", [argsWithBindings]],
      "expect": {
        "kind": "value" | "throws" | "shape",
        "value": <exact object/array/scalar>,             // for kind=value, full equality
        "pick":  { "<key>": <v>, ... },                   // for kind=value, subset equality (dynamic fields)
        "throws": { "errorName": "ExportError" },         // for kind=throws
        "shape": { "requiredKeys": ["k1", "k2"] },         // for kind=shape
        "expectFailuresContains": { "code": "..." }       // optional assertion on nested failures[]
      }
    }
  ]
}
```

Bindings: a string beginning with `$` is resolved from a prior `setup`/`serializeFirst` result
by dotted path (e.g. `$snapshot.platform.os`).

## Running

```bash
# Against the canonical Node package (stages package first):
node scripts/run-conformance.mjs --self contracts/conformance/vectors.safe-path-resolver.json
node scripts/run-conformance.mjs --self contracts/conformance/vectors.runtime-capability-inspector.json

# Against any staged package implementation (used by native ports later):
node scripts/run-conformance.mjs contracts/conformance/vectors.<cube>.json packages/<cube>
```

The runner stages the package via `scripts/package-stage.mjs` (mirrors the release pipeline),
then dynamic-imports `packages/<cube>/src/index.js` and executes each vector. A native port
points the runner at its own staged entry point and reuses the SAME vector file.

Exit code `0` = all vectors satisfied.

CI runs both canonical suites on every push/PR via `.github/workflows/verify.yml`
("Language-neutral conformance" step).

## Do / Don't

- DO update `value`/`pick` expectations only when the canonical Node behavior intentionally changes
  and the change is reviewed — never to make a weak port pass.
- DO NOT create fake ports: a native implementation is added only with real contract + applicability
  + tests + measurable conformance.
- DO extend this directory as more cubes become port candidates.
