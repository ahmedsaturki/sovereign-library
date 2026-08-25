import {
  inspectRuntime,
  evaluateRuntimeRequirements,
  serializeRuntimeReport,
} from '../cubes/runtime-capability-inspector/src/index.js';

const snapshot = inspectRuntime({
  executables: ['node', 'git', 'docker'],
});

const verdict = evaluateRuntimeRequirements(snapshot, {
  nodeMajorMin: 24,
  requiredExecutables: ['node'],
  minCpuCount: 1,
});

console.log(JSON.stringify({
  snapshot,
  verdict,
  serialized: serializeRuntimeReport(snapshot),
}, null, 2));
