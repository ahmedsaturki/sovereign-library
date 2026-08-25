import {
  buildPublicationConfirmation,
  serializePublicationConfirmation,
} from '../cubes/artifact-release-publication-confirmation/src/index.js';

const digest = 'sha256:' + 'b'.repeat(64);
const closureReceipt = {
  receiptId: 'closure-1', snapshotId: 'snapshot-1', snapshotChecksum: digest,
  approvalId: 'approval-1', approvalChecksum: digest, status: 'closed',
};
const plan = [{
  intentId: 'publish-1', idempotencyKey: 'publish-1', destinationId: 'local-demo',
  artifactId: 'artifact-1', artifactDigest: digest,
}];
const outcomeSnapshot = {
  mode: 'publication_outcome',
  closure: { receiptId: 'closure-1' },
  outcomes: [{
    intentId: 'publish-1', idempotencyKey: 'publish-1', destinationId: 'local-demo',
    artifactId: 'artifact-1', artifactDigest: digest, state: 'succeeded',
    commitEvidence: 'caller-supplied:demo-commit', committedAt: '2026-08-25T12:00:00Z',
    evidenceRefs: ['commit:demo'],
  }],
};

const receipt = buildPublicationConfirmation({ closureReceipt, outcomeSnapshot, plan });
console.log(serializePublicationConfirmation(receipt));
