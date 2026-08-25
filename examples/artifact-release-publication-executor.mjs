import {
  buildPublicationPlan,
  executePublicationPlan,
  serializePublicationSnapshot,
} from '../cubes/artifact-release-publication-executor/src/index.js';

const digest = 'sha256:' + 'a'.repeat(64);
const closureReceipt = {
  receiptId: 'closure-1',
  snapshotId: 'snapshot-1',
  snapshotChecksum: digest,
  approvalId: 'approval-1',
  approvalChecksum: digest,
  status: 'closed',
};

const calls = [];
const destination = {
  destinationId: 'local-demo',
  operations: ['publish'],
  async prepare(intent) {
    calls.push(`prepare:${intent.intentId}`);
    return { artifactId: intent.artifactId };
  },
  async commit(prepared) {
    calls.push(`commit:${prepared.artifactId}`);
    return { published: prepared.artifactId };
  },
};

const plan = buildPublicationPlan({
  closureReceipt,
  destinations: [destination],
  intents: [{
    intentId: 'publish-1',
    idempotencyKey: 'publish-1',
    destinationId: 'local-demo',
    artifactId: 'artifact-1',
    artifactDigest: digest,
    operations: ['publish'],
    payload: { version: '1.0.0' },
  }],
});

const outcome = await executePublicationPlan(plan, [destination]);
console.log(JSON.stringify({ calls, outcome, snapshot: serializePublicationSnapshot(outcome) }, null, 2));
