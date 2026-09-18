# Release / Verification Harness Cube

Standalone local verification orchestrator with native child-process execution.

## Guarantees

- no shell execution
- deterministic stage ordering
- bounded output capture
- per-stage timeout/cancellation/retry
- required vs optional stage verdicts
- immutable machine-readable snapshots
- zero runtime third-party dependencies

## Example

```js
import { createVerificationHarness } from './src/index.js';

const harness = createVerificationHarness({
  stages: [
    { id: 'syntax', command: process.execPath, args: ['--check', 'cubes/browser/src/index.js'] },
  ],
});

console.log(await harness.run());
```
