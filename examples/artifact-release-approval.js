import { buildReleaseApproval, serializeReleaseApproval } from '../cubes/artifact-release-approval/src/index.js';

const record = buildReleaseApproval(
  { snapshotId: 'release-1', snapshotChecksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  [{ id: 'security', required: true }, { id: 'ops', required: true }],
  [
    { id: 'sec-1', reviewerId: 'alice', scopeId: 'security', state: 'approve', evidenceRefs: ['ticket:1'] },
    { id: 'ops-1', reviewerId: 'bob', scopeId: 'ops', state: 'approve', evidenceRefs: ['ticket:2'] },
  ],
);

console.log(JSON.stringify(record, null, 2));
console.log(serializeReleaseApproval(record));
