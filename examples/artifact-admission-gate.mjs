import { evaluateAdmission, serializeAdmission, parseAdmission } from '../cubes/artifact-admission-gate/src/index.js';

const result = evaluateAdmission(
  { id: 'release-a', version: '2.4.1', lifecycle: 'live', compliant: true },
  { clauses: [
    { id: 'compliant', kind: 'required', category: 'compliance', field: 'compliant', predicate: 'equals', expected: true },
    { id: 'version', kind: 'required', category: 'version', field: 'version', predicate: 'semverGte', expected: '2.0.0' },
    { id: 'live', kind: 'required', category: 'lifecycle', field: 'lifecycle', predicate: 'equals', expected: 'live' },
  ] },
);

const wire = serializeAdmission(result);
console.log(JSON.stringify(parseAdmission(wire), null, 2));
