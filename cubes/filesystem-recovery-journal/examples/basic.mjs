import { createRecoveryJournal } from '../src/index.js';

const journal = createRecoveryJournal({ path: './runtime/recovery.frj' });
const operation = await journal.beginOperation({
  kind: 'file-replace',
  targets: ['./data/config.json'],
});

await journal.transition(operation.operationId, 'started');
await journal.observe(operation.operationId, { stage: 'candidate-ready' });

const pending = await journal.inspectRecoverable();
console.log('recoverable:', pending.map(({ operationId, state }) => ({ operationId, state })));

await journal.complete(operation.operationId, 'succeeded', { result: 'committed' });
