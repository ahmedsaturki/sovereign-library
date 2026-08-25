import { createProvenanceLedger, parseProvenanceSnapshot } from '../cubes/artifact-provenance-lineage-ledger/src/index.js';

const ledger = createProvenanceLedger();
ledger.append({
  eventId: 'build-1',
  actor: 'builder',
  action: 'build',
  source: 'ci',
  parents: ['source-tree'],
  derivedArtifact: 'binary',
  metadata: { target: 'cross-platform' },
});
ledger.append({
  eventId: 'package-1',
  actor: 'packager',
  action: 'package',
  source: 'release',
  parents: ['binary'],
  derivedArtifact: 'bundle',
  metadata: { format: 'sovereign-bundle' },
});

console.log('Ancestors:', ledger.ancestors('bundle'));
const serialized = ledger.serialize();
const restored = parseProvenanceSnapshot(serialized);
console.log('Restored stats:', restored.stats());
