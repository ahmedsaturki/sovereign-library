import { createBundle, verifyBundle, extractBundle } from '../cubes/artifact-bundle/src/index.js';

const bundle = createBundle([
  { path: 'hello.txt', bytes: new TextEncoder().encode('hello sovereign') },
  { path: 'docs/readme.txt', bytes: new TextEncoder().encode('deterministic bundle') },
], { metadata: { product: 'artifact-bundle', version: 1 } });

console.log(verifyBundle(bundle.bytes));
await extractBundle(bundle.bytes, './artifact-bundle-output');
