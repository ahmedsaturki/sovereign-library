import { snapshotDirectory } from '../cubes/directory-snapshot-tree-manifest/src/index.js';

const root = process.argv[2] ?? process.cwd();
const snapshot = await snapshotDirectory(root, {
  symlinkPolicy: 'record-only',
  mutationPolicy: 'record-warning',
});

console.log(JSON.stringify({
  snapshotId: snapshot.snapshotId,
  root: snapshot.root,
  entries: snapshot.entries,
  warnings: snapshot.warnings,
}, null, 2));
