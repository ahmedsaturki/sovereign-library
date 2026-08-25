import { ArtifactLifecycleIndex } from '../cubes/artifact-lifecycle-retention/src/index.js';

const index = await new ArtifactLifecycleIndex({ file: './state.sal' }).open();
await index.add({
  id: 'artifact:demo:1',
  state: 'live',
  createdAt: 0,
  updatedAt: 0,
  tags: ['stable'],
  references: ['cas:demo'],
  metadata: { owner: 'sovereign' },
});

console.log(index.retentionPlan({ expireAfterMs: 1000 }, 1000));
console.log(index.purgePlan({ states: ['expired', 'tombstoned'], olderThan: 1000 }));
