import { createSnapshotStore } from '../cubes/storage-persistence/src/index.js';

const store = createSnapshotStore();
const file = new URL('../.tmp-storage-example.slib', import.meta.url);

await store.save(file, { project: 'sovereign-library', revision: 1 }, { example: true });
const snapshot = await store.load(file);

console.log(snapshot.payload);

// Example cleanup is intentionally left to the caller when embedding this snippet.
