# Artifact Release Plan / Deterministic Publication Plan v0.1

Standalone, dependency-free dry-run planner for explicit eligible artifacts and explicit dependency edges.

## Contract

`buildReleasePlan(artifacts, dependencies, config)` validates the supplied graph, optionally requires `admissionVerdict: "eligible"`, rejects unknown/duplicate/cyclic dependencies, and returns a deterministic dependency-first release plan.

The cube is intentionally **plan-only**. It does not publish, deploy, mutate artifacts, discover dependencies, access a registry, or call a remote release service.

## Example

```js
import { buildReleasePlan } from './src/index.js';

const plan = buildReleasePlan(
  [
    { id: 'app', admissionVerdict: 'eligible', evidenceRefs: ['digest:app'] },
    { id: 'base', admissionVerdict: 'eligible', evidenceRefs: ['digest:base'] },
  ],
  [{ from: 'base', to: 'app' }],
);

console.log(plan.order); // [ 'base', 'app' ]
```

## Integrity

`serializeReleasePlan()` emits an `SRP1` JSON envelope protected by SHA-256. `parseReleasePlan()` verifies the checksum before exposing the frozen report.

## Bounds and failure behavior

The cube rejects accessors, circular objects, duplicate artifact/dependency identities, unknown dependency references, admission blocks, invalid limits, malformed evidence references, cycles, and oversized inputs with typed `ReleasePlanError` instances.
