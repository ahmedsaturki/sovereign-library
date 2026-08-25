import { auditSnapshots, serializeAudit } from '../cubes/artifact-audit-drift-reporter/src/index.js';

const baseline = { records: [
  { id: 'pkg/a', digest: 'sha256:111', version: '1.0.0', lifecycle: 'live', parents: [] },
  { id: 'pkg/b', digest: 'sha256:222', version: '1.0.0', lifecycle: 'live', parents: ['pkg/a'] },
] };

const current = { records: [
  { id: 'pkg/a', digest: 'sha256:999', version: '1.1.0', lifecycle: 'live', parents: [] },
  { id: 'pkg/c', digest: 'sha256:333', version: '1.0.0', lifecycle: 'live', parents: [] },
] };

const report = auditSnapshots(baseline, current);
console.log(JSON.stringify(report, null, 2));
console.log(serializeAudit(report));
