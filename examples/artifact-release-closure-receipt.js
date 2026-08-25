import { buildReleaseClosure, serializeReleaseClosure } from '../cubes/artifact-release-closure-receipt/src/index.js';

const receipt = buildReleaseClosure(
  { id: 'snapshot-1', checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  {
    id: 'approval-1',
    checksum: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    status: 'approved',
    snapshotId: 'snapshot-1',
    snapshotChecksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
  { receiptId: 'closure-1', metadata: { release: '1.0.0' }, evidenceRefs: ['approval:1'] },
);

console.log(JSON.stringify(receipt, null, 2));
console.log(serializeReleaseClosure(receipt));
