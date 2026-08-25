import { ArtifactCatalog } from '../cubes/artifact-catalog/src/index.js';

const catalog = await new ArtifactCatalog({ file: './artifact-catalog.sac' }).open();
await catalog.add({
  identifier: 'demo:hello:1.0.0',
  packageName: 'demo',
  version: '1.0.0',
  digest: 'a'.repeat(64),
  tags: ['stable'],
  metadata: { channel: 'stable' },
});

console.log(catalog.query({ packageName: 'demo' }));
