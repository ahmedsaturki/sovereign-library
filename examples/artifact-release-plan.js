import { buildReleasePlan, serializeReleasePlan } from '../cubes/artifact-release-plan/src/index.js';

const plan = buildReleasePlan(
  [
    { id: 'app', admissionVerdict: 'eligible', evidenceRefs: ['digest:app', 'lineage:app'] },
    { id: 'base', admissionVerdict: 'eligible', evidenceRefs: ['digest:base'] },
    { id: 'config', admissionVerdict: 'eligible', evidenceRefs: ['config:42'] },
  ],
  [
    { from: 'base', to: 'app' },
    { from: 'config', to: 'app' },
  ],
);

console.log(JSON.stringify(plan, null, 2));
console.log(serializeReleasePlan(plan));
