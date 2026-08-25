import { writeFileAtomic } from '../cubes/atomic-file-writer-safe-replace/src/index.js';

const result = await writeFileAtomic('./example-output.json', JSON.stringify({ generated: true, version: 1 }) + '\n', {
  idGenerator: () => 'example-operation-1',
  metadata: { source: 'standalone-example' },
});

console.log(JSON.stringify(result, null, 2));
