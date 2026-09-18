# Atomic Batch File Transaction / Safe Multi-File Commit v0.1

Standalone filesystem transaction primitive for bounded local batches of file create, replace, and delete operations.

The cube validates the complete plan before mutation, stages owned temporary files, applies deterministic operations, reports the strongest supported guarantee level, and fails closed when rollback or recovery cannot be proven safe.

## Guarantees

`strong-local` is reported only when the selected local filesystem capability profile supports the required same-filesystem replacement primitives. Otherwise the receipt reports `best-effort`.

This cube does not claim distributed transactions or universal power-loss atomicity.

## Public API

- `planBatch()`
- `commitBatch()`
- `rollbackBatch()`
- `recoverBatch()`
- `serializeReceipt()`
- `parseReceipt()`

## Safety properties

The cube uses explicit root containment, rejects duplicate destinations, bounds operation/content sizes, isolates executable capability seams, protects receipts with ABT1 SHA-256 integrity, and keeps diagnostics coarse.

## Example

```js
import { planBatch, commitBatch } from './src/index.js';

const plan = planBatch({
  root: '/tmp/example-root',
  transactionId: 'example-1',
  operations: [
    { type: 'create', destination: 'one.txt', content: 'one' },
    { type: 'replace', destination: 'two.txt', content: 'two' },
  ],
});

const receipt = await commitBatch(plan);
console.log(receipt.state, receipt.guaranteeLevel);
```

See the frozen SPEC in `specs/atomic-batch-file-transaction-safe-multi-file-commit-v0.1.md` for platform boundaries and recovery semantics.
