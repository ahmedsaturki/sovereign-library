import { createVerificationHarness } from '../cubes/release-verification-harness/src/index.js';

const harness = createVerificationHarness({
  stages: [
    { id: 'node-version', command: process.execPath, args: ['--version'] },
    { id: 'syntax', command: process.execPath, args: ['--check', 'cubes/release-verification-harness/src/index.js'] },
  ],
});

console.log(JSON.stringify(await harness.run(), null, 2));
