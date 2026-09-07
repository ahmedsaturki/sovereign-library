# Artifact Lifecycle / Retention Index v0.1

Standalone deterministic local lifecycle state and retention planner for artifact references.

## Example

```js
import { ArtifactLifecycleIndex } from './src/index.js';

const index = await new ArtifactLifecycleIndex({ file: './state.sal' }).open();
await index.add({
  id: 'artifact:hello',
  state: 'live',
  createdAt: 0,
  updatedAt: 0,
  tags: ['stable'],
  references: ['cas:abc'],
  metadata: { owner: 'demo' },
});

console.log(index.retentionPlan({ expireAfterMs: 86_400_000 }, 86_400_000));
console.log(index.purgePlan({ olderThan: 86_400_000 }));
```

## Contract

Lifecycle state is explicit and transition-checked. Retention evaluation is pure and takes an explicit `now`. Purge planning is dry-run only and never performs destructive physical deletion.

Persistence uses canonical `SAL1` state with a SHA-256 checksum and atomic replacement. Snapshots are immutable values and malformed/corrupt/accessor-bearing inputs fail closed.

Runtime dependencies: none.
