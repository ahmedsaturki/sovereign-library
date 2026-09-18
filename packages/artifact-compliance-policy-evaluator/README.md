# Artifact Compliance / Policy Evaluator v0.1

Standalone deterministic evaluator for explicit artifact records against explicit caller-supplied compliance rules.

## Guarantees

- Zero runtime third-party dependencies.
- No network, registry, or filesystem discovery.
- No source mutation or automatic repair.
- Deterministic rule ordering and finding ordering.
- Immutable reports and typed fail-closed errors.
- Bounded rules, artifacts, metadata, strings, findings, and regex patterns.
- Checksum-protected `SCP1` report serialization.

## Example

```js
import {
  evaluateCompliance,
  serializeCompliance,
  parseCompliance,
} from './src/index.js';

const report = evaluateCompliance(
  [{ id: 'pkg-a', digest: 'sha256:abc', version: 2, lifecycle: 'live' }],
  [{
    id: 'live-only',
    category: 'lifecycle',
    severity: 'high',
    field: 'lifecycle',
    operator: 'equals',
    value: 'live',
  }],
);

const wire = serializeCompliance(report);
const restored = parseCompliance(wire);
console.log(restored.verdict);
```

Run the cube tests with:

```bash
npm run test:artifact-compliance-policy-evaluator
```
