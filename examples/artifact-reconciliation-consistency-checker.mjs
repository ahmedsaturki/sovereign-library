import { reconcileSnapshots, serializeReport } from '../cubes/artifact-reconciliation-consistency-checker/src/index.js';

const report = reconcileSnapshots(
  { records: [{ id: 'app', digest: 'sha256:1', version: '1', lifecycle: 'live', parents: [] }] },
  { records: [{ id: 'app', digest: 'sha256:2', version: '1', lifecycle: 'live', parents: [] }] },
);

console.log(report);
console.log(serializeReport(report));
