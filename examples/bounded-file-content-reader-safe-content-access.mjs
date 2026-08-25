import { readFileContent, readFileChunks } from '../cubes/bounded-file-content-reader-safe-content-access/src/index.js';

const path = process.argv[2] ?? '.';
const mode = process.argv[3] ?? 'text';

if (mode === 'chunks') {
  for await (const chunk of readFileChunks(path, { mode: 'binary', chunkSize: 64 * 1024 })) {
    console.log(chunk.offset, chunk.actualBytes);
  }
} else {
  const result = await readFileContent(path, { mode });
  console.log(mode === 'text' ? result.text : `${result.actualBytes} bytes`);
}
