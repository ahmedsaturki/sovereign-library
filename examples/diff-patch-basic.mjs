import { applyPatch, diff } from '../cubes/diff-patch/src/index.js';

const before = {
  name: 'library',
  settings: { enabled: false },
  items: ['a', 'b'],
};

const after = {
  name: 'library',
  settings: { enabled: true, mode: 'safe' },
  items: ['a', 'c', 'd'],
};

const operations = diff(before, after);
const result = applyPatch(before, operations);

console.log(JSON.stringify(operations, null, 2));
console.log(JSON.stringify(result, null, 2));
