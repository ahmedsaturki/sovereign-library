# Artifact Admission Gate / Release Eligibility v0.1

Standalone deterministic gate for deciding whether an explicit artifact is eligible for release using caller-supplied admission clauses.

## Guarantees

- Zero runtime third-party dependencies.
- No network, discovery, registry lookup, scheduler, or publication behavior.
- Required failures block admission; optional failures are recorded but non-blocking.
- Deterministic clause ordering and immutable results.
- Bounded input scanning and typed fail-closed errors.
- `SAG1` checksum-protected result serialization.

## Example

```js
import { evaluateAdmission } from './src/index.js';

const result = evaluateAdmission(
  { id: 'pkg-a', version: '2.1.0', lifecycle: 'live', compliant: true },
  { clauses: [
    { id: 'compliant', kind: 'required', category: 'compliance', field: 'compliant', predicate: 'equals', expected: true },
    { id: 'version', kind: 'required', category: 'version', field: 'version', predicate: 'semverGte', expected: '2.0.0' },
  ] },
);

console.log(result.verdict);
```

Run tests with:

```bash
npm run test:artifact-admission-gate
```
