import { inspectPath, createNodeCapabilities, serializeDescriptor } from '../src/index.js';
import { lstat } from 'node:fs/promises';

const descriptor = await inspectPath(process.argv[2] ?? process.cwd(), createNodeCapabilities({ lstat }));
console.log(serializeDescriptor(descriptor));
