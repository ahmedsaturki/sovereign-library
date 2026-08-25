import { createSearchIndex } from '../cubes/search-index/src/index.js';

const index = createSearchIndex();
index.rebuild([
  { id: '1', fields: { title: 'Native browser', body: 'fast deterministic browser control' } },
  { id: '2', fields: { title: 'Testing', body: 'deterministic web application testing' } },
  { id: '3', fields: { title: 'Search', body: 'fast local text search' } },
]);

console.log('TERM', index.term({ field: 'body', value: 'fast' }));
console.log('AND', index.and({ field: 'body', terms: ['deterministic', 'browser'] }));
console.log('PREFIX', index.prefix({ field: 'body', value: 'brow' }));
console.log('PHRASE', index.phrase({ field: 'body', terms: ['fast', 'deterministic'] }));
console.log('STATS', index.stats());