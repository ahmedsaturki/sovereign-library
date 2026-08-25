import { evaluateCompliance, serializeCompliance, parseCompliance } from '../cubes/artifact-compliance-policy-evaluator/src/index.js';

const report = evaluateCompliance(
  [
    { id: 'app-a', digest: 'sha256:abc', version: 3, lifecycle: 'live', metadata: { env: 'prod' } },
  ],
  [
    { id: 'live-prod', category: 'lifecycle', severity: 'high', field: 'lifecycle', operator: 'equals', value: 'live' },
    { id: 'prod-env', category: 'metadata', severity: 'medium', field: 'metadata.env', operator: 'equals', value: 'prod' },
    { id: 'min-version', category: 'version', severity: 'critical', field: 'version', operator: 'gte', value: 2 },
  ],
);

const wire = serializeCompliance(report);
const restored = parseCompliance(wire);
console.log(JSON.stringify(restored, null, 2));
