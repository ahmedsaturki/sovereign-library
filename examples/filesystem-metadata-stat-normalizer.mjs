import { normalizeStat, serializeMetadata, parseMetadata } from '../cubes/filesystem-metadata-stat-normalizer/src/index.js';

const path = process.argv[2] ?? '.';
const metadata = await normalizeStat(path, { symlinkPolicy: 'lstat', includeSymlinkTarget: true });
const wire = serializeMetadata(metadata);
const restored = parseMetadata(wire);

console.log(JSON.stringify(restored, null, 2));
