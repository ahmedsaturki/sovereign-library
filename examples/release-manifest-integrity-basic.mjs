import { createManifest, serializeManifest, verifyManifest, parseManifest } from '../cubes/release-manifest-integrity/src/index.js';

const entries = [
  { path: 'README.txt', content: 'Sovereign' },
  { path: 'build/app.js', content: 'console.log("ok")' },
];

const manifest = createManifest(entries);
const wire = serializeManifest(manifest);
const restored = parseManifest(wire);
const report = verifyManifest(restored, entries);

console.log(JSON.stringify({ manifest: restored, report }, null, 2));
