import { buildReleaseSnapshot, serializeReleaseSnapshot } from '../cubes/artifact-release-snapshot/src/index.js';

const snapshot = buildReleaseSnapshot([
  {
    id: 'base',
    version: '1.0.0',
    digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    admissionVerdict: 'eligible',
    evidenceRefs: ['digest:base'],
  },
  {
    id: 'app',
    version: '2.1.0',
    digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    admissionVerdict: 'eligible',
    evidenceRefs: ['digest:app', 'admission:app'],
  },
], { maxEvidence: 2 });

console.log(JSON.stringify(snapshot, null, 2));
console.log(serializeReleaseSnapshot(snapshot));
