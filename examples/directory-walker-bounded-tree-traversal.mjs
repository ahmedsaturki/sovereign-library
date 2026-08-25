import { walk } from '../cubes/directory-walker-bounded-tree-traversal/src/index.js';

const result = await walk(process.argv[2] ?? '.', {
  maxDepth: 8,
  maxEntries: 10_000,
  maxWorkUnits: 200_000,
  symlinkPolicy: 'report',
});

for (const entry of result) console.log(`${entry.type}\t${entry.path}`);
